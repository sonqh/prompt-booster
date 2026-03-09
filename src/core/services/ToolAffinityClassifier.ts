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

// ─── MCP tool descriptor (mirrors MCPToolRegistry.MCPToolDescriptor) ─────────

export interface MCPToolDescriptor {
  serverName: string;        // e.g. "postgres-mcp"
  toolName: string;          // e.g. "query_db"
  qualifiedName: string;     // e.g. "postgres-mcp.query_db"
  description: string;
  inputSummary?: string;
  /** Whether the server was confirmed active/enabled in the workspace. */
  enabled: boolean;
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface MCPToolScore {
  tool: MCPToolDescriptor;
  score: number;
}

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

  // ── Score MCP tools (enabled only) ─────────────────────────────────────────
  const promptLower = prompt.toLowerCase();
  const enabledMcpTools = mcpCatalog.filter((t) => t.enabled);

  const mcpScored: MCPToolScore[] = enabledMcpTools
    .map((tool) => {
      const descWords = tool.description
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean);

      const descScore = descWords.reduce(
        (acc, word) =>
          acc + (word.length > 3 && promptLower.includes(word) ? 1 : 0),
        0,
      );

      // Bonus for server name or tool name appearing verbatim in the prompt
      const nameBonus =
        (promptLower.includes(tool.serverName.toLowerCase()) ? 2 : 0) +
        (promptLower.includes(tool.toolName.toLowerCase()) ? 2 : 0);

      return { tool, score: descScore + nameBonus };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // hard cap

  const mcpTools = mcpScored.map(({ tool }) => tool);

  // ── Build combined placement guidance ──────────────────────────────────────
  const builtInGuidance = suggestedTools.map(
    (t) => `- ${TOOL_PLACEMENT_GUIDANCE[t]}`,
  );

  const mcpGuidance = mcpTools.map(
    (t) =>
      `- embed \`${t.qualifiedName}\` in the sentence where ${t.description.toLowerCase()} is needed`,
  );

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
