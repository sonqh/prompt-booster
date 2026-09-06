/**
 * ToolAffinityClassifier
 *
 * Zero-latency, zero-LLM classifier that scores VS Code Copilot built-in tools
 * AND MCP tools against the user's prompt. Produces placement-guidance annotations
 * that are injected into the LLM system prompt so tool references are woven INLINE
 * into the enhanced prompt (not collected in a trailing list).
 */

import type { CopilotTool } from "../../shared/types/PromptResult";
export type { CopilotTool }; // re-export so callers only need this file

// ─── MCP tool descriptor ─────────────────────────────────────────────────────
// Canonical type lives in shared/types/McpToolTypes.ts (single source of truth
// shared with MCPToolRegistry) — re-exported here so callers only need this file.

export type { MCPToolDescriptor } from "../../shared/types/McpToolTypes";
import type { MCPToolDescriptor } from "../../shared/types/McpToolTypes";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ToolAffinityResult {
  /** VS Code built-in tools that matched the prompt. */
  suggestedTools: CopilotTool[];
  /** Top MCP tools (enabled only) that matched the prompt; capped at 5. */
  mcpTools: MCPToolDescriptor[];
  /**
   * A combined placement-instruction block injected into the LLM input.
   * Tells the model WHICH tools to use and WHERE (in which sentence) to embed
   * them — NOT a ready-to-append block. The LLM weaves the references inline.
   */
  toolAnnotations: string;
}

// ─── MCP scorer v2 (Enhancement 4 v2, plan section 7) ─────────────────────────

/**
 * Generic-in-coding-context words that must never count as an affinity signal.
 * Plain data — extendable without logic changes. Deliberately excludes verbs
 * like create/run/query/read/write (those carry real signal).
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "this", "that", "these", "those", "and", "or", "but",
  "with", "from", "into", "onto", "over", "under", "for", "to", "of", "in",
  "on", "at", "by", "as", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "can", "could", "should", "would", "will", "shall",
  "may", "might", "must", "have", "has", "had", "i", "you", "he", "she",
  "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "our",
  "their", "its", "not", "no", "yes", "if", "then", "else", "when", "what",
  "which", "who", "how", "why", "where", "all", "any", "some", "use",
  "using", "used", "need", "needs", "want", "please", "help", "make", "made",
  "get", "got", "put", "set", "via", "per", "more", "most", "very", "also",
  "just", "only", "about", "after", "before", "between", "during",
  "through", "against", "without", "within",
  "file", "files", "code", "data", "tool", "tools", "server", "servers", "mcp",
]);

/** A score at or above this qualifies a tool for injection. */
const QUALIFY_THRESHOLD = 2.0;
/** Hard cap on injected MCP tools per prompt. */
const MAX_MCP_TOOLS = 5;
/** Whole-word server/tool name match bonus (each). */
const NAME_MATCH_BONUS = 4;

/** lowercase word tokens: letters, digits, underscores. */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
}

/**
 * Crude stemming so plural/singular variants align on both sides:
 * "queries"→"query", "tables"→"table", "files"→"file". Only applied to
 * tokens longer than 4 chars (short words like "rows" stay intact).
 */
function normalizeToken(tok: string): string {
  return tok.length > 4 ? tok.replace(/ies$/, "y").replace(/s$/, "") : tok;
}

/** Content tokens are ≥ 4 chars and not stopwords. */
function isContentToken(tok: string): boolean {
  return tok.length >= 4 && !STOPWORDS.has(tok);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word (boundary) match of a server/tool name in the lowercased prompt.
 * `\b` treats '-' as a boundary, so `\bpostgres-mcp\b` matches correctly.
 */
function wholeWordMatch(name: string, promptLower: string): boolean {
  if (!name) return false;
  return new RegExp(`\\b${escapeRegExp(name)}\\b`).test(promptLower);
}

/** Weight of a matched content token: longer tokens are stronger signals. */
function tokenWeight(token: string): number {
  return token.length >= 6 ? 2 : 1;
}

/**
 * Sanitize a third-party (untrusted) tool description before it enters the
 * optimizer prompt: strip control characters/newlines, collapse whitespace,
 * cap the length. Tool descriptions are prompt-injection surface.
 */
function sanitizeDescriptionSnippet(description: string, maxChars = 200): string {
  const cleaned = description
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxChars
    ? `${cleaned.slice(0, maxChars - 1).trimEnd()}…`
    : cleaned;
}

interface McpScoreBreakdown {
  tool: MCPToolDescriptor;
  final: number;
  nameBonus: number;
}

/** Score one MCP tool against the prompt per the scorer v2 rules. */
function scoreMcpTool(
  tool: MCPToolDescriptor,
  promptLower: string,
  promptTokens: ReadonlySet<string>,
): McpScoreBreakdown {
  const descTokens = [
    ...new Set(
      tokenize(tool.description).map(normalizeToken).filter(isContentToken),
    ),
  ];

  const matched = descTokens.filter((t) => promptTokens.has(t));
  const base = matched.reduce((acc, t) => acc + tokenWeight(t), 0);
  // Length normalization: laundry-list descriptions are penalized.
  const lengthNorm =
    descTokens.length > 0 ? base / Math.sqrt(descTokens.length) : 0;

  const nameBonus =
    (wholeWordMatch(tool.serverName, promptLower) ? NAME_MATCH_BONUS : 0) +
    (wholeWordMatch(tool.toolName, promptLower) ? NAME_MATCH_BONUS : 0);

  return { tool, final: lengthNorm + nameBonus, nameBonus };
}

// ─── Signal tables ────────────────────────────────────────────────────────────

const TOOL_SIGNALS: Record<CopilotTool, RegExp[]> = {
  "#file":                [/\bfile\b/i, /\bin\s+\S+\.\w{2,4}\b/i, /\bopen\b/i, /\bimport\b/i],
  "#selection":           [/\bselection\b/i, /\bselected\b/i, /\bhighlighted\b/i, /\bthis code\b/i],
  "#editor":              [/\bthis file\b/i, /\bcurrent file\b/i, /\bactive file\b/i, /\bhere\b/i],
  "#codebase":            [/\brefactor\b/i, /\bacross\b/i, /\ball files\b/i, /\bentire project\b/i, /\barchitecture\b/i],
  "#terminalLastCommand": [/\berror\b/i, /\bfailed\b/i, /\bcrash\b/i, /\bbuild\b/i, /\btest fail/i, /\bexception\b/i],
  "#terminalSelection":   [/\bterminal selection\b/i, /\bselected.*terminal\b/i],
  "@workspace":           [/\bwhere is\b/i, /\bfind\b/i, /\bsearch\b/i, /\bwhich file\b/i, /\bacross the (?:repo|project|codebase)\b/i],
  "@terminal":            [/\brun\b/i, /\bcommand\b/i, /\bscript\b/i, /\bnpm\b/i, /\byarn\b/i, /\bshell\b/i],
  "@vscode":              [/\bsetting\b/i, /\bextension\b/i, /\bkeybinding\b/i, /\btheme\b/i, /\bworkspace setting\b/i],
};

const TOOL_PLACEMENT_GUIDANCE: Record<CopilotTool, string> = {
  "#file":                "embed #file:<path> in the Task or Context sentence that names the specific file",
  "#selection":           "embed #selection in the Task sentence that references the highlighted code",
  "#editor":              "embed #editor in any sentence that refers to the full content of the active file",
  "#codebase":            "embed #codebase in Requirements that involve searching across the whole project",
  "#terminalLastCommand": "embed #terminalLastCommand in the Context sentence that references the error output",
  "#terminalSelection":   "embed #terminalSelection in the Context sentence referencing terminal-selected text",
  "@workspace":           "embed @workspace in Requirements that involve cross-file lookup or navigation",
  "@terminal":            "embed @terminal in Requirements that involve running a shell command",
  "@vscode":              "embed @vscode in Requirements about editor settings or extension behaviour",
};

// ─── Main classifier ──────────────────────────────────────────────────────────

/**
 * Classify built-in Copilot tools and MCP tools relevant to the given prompt.
 *
 * @param prompt      The user's (possibly cleaned) prompt text.
 * @param mcpCatalog  Optional list of MCP tools discovered from workspace config.
 *                    Only tools with `enabled === true` are scored.
 */
export function classifyTools(
  prompt: string,
  mcpCatalog: MCPToolDescriptor[] = [],
): ToolAffinityResult {

  // ── Score built-in tools ────────────────────────────────────────────────────
  const scored = (Object.entries(TOOL_SIGNALS) as [CopilotTool, RegExp[]][])
    .map(([tool, patterns]): [CopilotTool, number] => [
      tool,
      patterns.reduce((acc, re) => acc + (re.test(prompt) ? 1 : 0), 0),
    ])
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  const suggestedTools = scored.map(([tool]) => tool);

  // ── Score MCP tools (enabled only) — scorer v2 ─────────────────────────────
  const promptLower = prompt.toLowerCase();
  const promptTokens = new Set(tokenize(prompt).map(normalizeToken));

  const mcpScored: McpScoreBreakdown[] = mcpCatalog
    .filter((t) => t.enabled)
    .map((tool) => scoreMcpTool(tool, promptLower, promptTokens))
    .filter(({ final }) => final >= QUALIFY_THRESHOLD)
    // Deterministic total order: nameBonus desc → final desc →
    // description length asc (specificity) → qualifiedName asc (stability).
    .sort((a, b) => {
      if (a.nameBonus !== b.nameBonus) return b.nameBonus - a.nameBonus;
      if (a.final !== b.final) return b.final - a.final;
      const lenDiff = a.tool.description.length - b.tool.description.length;
      if (lenDiff !== 0) return lenDiff;
      return a.tool.qualifiedName < b.tool.qualifiedName ? -1 : 1;
    })
    .slice(0, MAX_MCP_TOOLS); // hard cap

  const mcpTools = mcpScored.map(({ tool }) => tool);

  // ── Build combined placement guidance ──────────────────────────────────────
  const builtInGuidance = suggestedTools.map(
    (t) => `- ${TOOL_PLACEMENT_GUIDANCE[t]}`,
  );

  const mcpGuidance = mcpTools.map((t) => {
    const foreignNote =
      t.visibility === "foreign"
        ? " (other-editor tool — only use if available here)"
        : "";
    return `- embed \`${t.qualifiedName}\`${foreignNote} in the sentence where ${sanitizeDescriptionSnippet(
      t.description,
    ).toLowerCase()} is needed`;
  });

  const allGuidance = [...builtInGuidance, ...mcpGuidance];

  const toolAnnotations =
    allGuidance.length > 0
      ? [
          "",
          "[Tool placement guidance — embed these tool references INLINE within the",
          "enhancedPrompt at the exact sentence where each is relevant. Do NOT collect them in",
          "a separate section.]",
          ...allGuidance,
        ].join("\n")
      : "";

  return { suggestedTools, mcpTools, toolAnnotations };
}
