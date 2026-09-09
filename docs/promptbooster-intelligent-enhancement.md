# PromptBooster — Intelligent Prompt Enhancement

## Tool-Aware Transformation · Rich Context Gathering · VS Code Reference Mapping · MCP-Aware Tool Provisioning

> **Scope:** This document defines the four core enhancements to the PromptBooster VS Code extension.
> Enhancements 1–3 run entirely inside the extension with no external dependencies.
> Enhancement 4 (MCP Awareness) discovers user-configured MCP servers and weaves their tool references into the enhanced prompt — PromptBooster never *executes* MCP tools, only references them for the downstream agent.

---

## Overview

The current PromptBooster pipeline is:

```
User raw prompt → OPTIMIZATION system prompt → LLM → enhancedPrompt + intent
```

After these enhancements, the pipeline becomes:

```
User raw prompt
  + VS Code reference resolution (#file, #selection, @workspace …)
  + Rich workspace context gathering
  + MCP tool registry (dynamic discovery of installed MCP servers)
  → OPTIMIZATION_V2 system prompt (tool-aware + MCP-aware)
  → LLM
  → enhancedPrompt + intent + suggestedTools + mcpTools + resolvedReferences
```

All four improvements are **additive and backward-compatible**. Existing `PromptResult.intent` and `enhancedPrompt` fields are preserved. If no MCP servers are configured, the pipeline behaves identically to Enhancements 1–3 alone.

### How PromptBooster Relates to the Meta-MCP Orchestrator

PromptBooster and the [Meta-MCP Orchestrator](meta-mcp-orchestrator.md) are **complementary systems** with a clean separation:

| | PromptBooster (this doc) | Meta-MCP Orchestrator |
|---|---|---|
| **Role** | Prompt **planner** — produces optimally structured prompts that name the right tools | Task **executor** — spawns parallel workers with provisioned MCP tools |
| **Runs where** | Inside the VS Code extension | Separate Node.js MCP server |
| **Touches MCP tools** | Read-only discovery (config files / VS Code API) | Full execution (proxy calls to local MCPs) |
| **Value alone** | High — agent picks better tools from the prompt | High — parallel execution, cost arbitrage |
| **Combined** | PromptBooster feeds the Meta-MCP with perfectly structured delegation prompts | Meta-MCP executes what PromptBooster planned |

---

## Enhancement 1 — Tool-Aware Prompt Transformation

### Problem

The current `enhancedPrompt` is a better-worded version of the user's request, but it carries no signal about **which Copilot built-in tools** the agent should activate. A prompt like *"fix the bug in the auth module"* generates an excellent rewrite but never tells the agent to open `#file:src/auth.ts`, search with `@workspace`, or check `#terminalLastCommand`.

### Goal

The enhanced prompt should **embed tool references inline** — woven directly into the sentences of `**Task**`, `**Context**`, and `**Requirements**` where each tool is actually needed. This is more effective than a trailing list because Copilot's agent runtime resolves each reference at the precise moment the sentence is processed, giving it the right data for that specific instruction.

**Example of inline embedding vs. trailing list:**

```
❌ Trailing list (old):          ✅ Inline embedding (target):
**Task**                         **Task**
Fix the null ref crash.          Inspect #file:src/auth/guard.ts for the
                                 null-reference crash and apply a fix.
**Tools**
- #editor                        **Context**
- @workspace                     Use @workspace to check if any other guard
                                 inherits from this class before modifying it.
```

### VS Code Copilot Built-in Tools Reference

| Tool Reference | Scope | When to inject |
|---|---|---|
| `#file:<path>` | Specific file content | Prompt mentions a known filename |
| `#selection` | Currently selected code | User's original prompt came from a selection |
| `#editor` | Entire active editor content | Task involves "this file" / "current file" |
| `#codebase` | Full workspace semantic search | Broad architectural, cross-file, or refactor tasks |
| `#terminalLastCommand` | Last terminal output | Prompt mentions build error, test failure, crash |
| `#terminalSelection` | Selected terminal text | Error text was selected in terminal |
| `@workspace` | Workspace-level agent | Any question spanning multiple files |
| `@terminal` | Terminal agent | Tasks involving commands or shell output |
| `@vscode` | VS Code settings / extensions | Prompt is about editor behavior or configuration |

### Implementation

#### 1.1 Tool Affinity Classifier (`src/core/services/ToolAffinityClassifier.ts`)

A **zero-LLM, zero-latency** classifier that scores each tool based on signal words in the prompt. Runs before the LLM call.

```typescript
// src/core/services/ToolAffinityClassifier.ts

export type CopilotTool =
  | "#file"
  | "#selection"
  | "#editor"
  | "#codebase"
  | "#terminalLastCommand"
  | "@workspace"
  | "@terminal"
  | "@vscode";

const TOOL_SIGNALS: Record<CopilotTool, RegExp[]> = {
  "#file":               [/\bfile\b/i, /\bin\s+\S+\.\w{2,4}\b/i, /\bopen\b/i, /\bimport\b/i],
  "#selection":          [/\bselection\b/i, /\bselected\b/i, /\bhighlighted\b/i, /\bthis code\b/i],
  "#editor":             [/\bthis file\b/i, /\bcurrent file\b/i, /\bactive file\b/i, /\bhere\b/i],
  "#codebase":           [/\brefactor\b/i, /\bacross\b/i, /\ball files\b/i, /\bentire project\b/i, /\barchitecture\b/i],
  "#terminalLastCommand":[/\berror\b/i, /\bfailed\b/i, /\bcrash\b/i, /\bbuild\b/i, /\btest fail\b/i, /\bexception\b/i],
  "@workspace":          [/\bwhere is\b/i, /\bfind\b/i, /\bsearch\b/i, /\bwhich file\b/i, /\bacross the (repo|project|codebase)\b/i],
  "@terminal":           [/\brun\b/i, /\bcommand\b/i, /\bscript\b/i, /\bnpm\b/i, /\byarn\b/i, /\bshell\b/i],
  "@vscode":             [/\bsetting\b/i, /\bextension\b/i, /\bkeybinding\b/i, /\btheme\b/i, /\bworkspace setting\b/i],
};

export interface ToolAffinityResult {
  suggestedTools: CopilotTool[];
  /**
   * A placement-instruction hint injected into the LLM input.
   * Tells the model WHICH tools to use and WHERE (in which section) to embed them —
   * NOT a ready-to-append block. The LLM weaves the references inline.
   *
   * Example value:
   *   "[Tool placement guidance]: embed #file:<path> in the Task sentence that names the
   *    target file; embed @workspace in any Requirement that involves a cross-file search;
   *    embed @terminal in any Requirement that involves running a command."
   */
  toolAnnotations: string;
}

/** Per-tool guidance on where to place it inline inside the enhanced prompt. */
const TOOL_PLACEMENT_GUIDANCE: Record<CopilotTool, string> = {
  "#file":                "embed #file:<path> in the Task or Context sentence that names the specific file",
  "#selection":           "embed #selection in the Task sentence that references the highlighted code",
  "#editor":              "embed #editor in any sentence that refers to the full content of the active file",
  "#codebase":            "embed #codebase in Requirements that involve searching across the whole project",
  "#terminalLastCommand": "embed #terminalLastCommand in the Context sentence that references the error output",
  "@workspace":           "embed @workspace in Requirements that involve cross-file lookup or navigation",
  "@terminal":            "embed @terminal in Requirements that involve running a shell command",
  "@vscode":              "embed @vscode in Requirements about editor settings or extension behaviour",
};

export function classifyTools(prompt: string): ToolAffinityResult {
  const scored: [CopilotTool, number][] = (Object.entries(TOOL_SIGNALS) as [CopilotTool, RegExp[]][])
    .map(([tool, patterns]) => [
      tool,
      patterns.reduce((acc, re) => acc + (re.test(prompt) ? 1 : 0), 0),
    ])
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  const suggestedTools = scored.map(([tool]) => tool);

  // Build a placement-instruction block for the LLM (not appended to the prompt body,
  // but injected as a system-level hint alongside the user request).
  const toolAnnotations = suggestedTools.length > 0
    ? [
        "[Tool placement guidance — embed these Copilot tool references INLINE within the",
        "enhancedPrompt at the exact sentence where each is relevant. Do NOT collect them in",
        "a separate section.]",
        ...suggestedTools.map((t) => `- ${TOOL_PLACEMENT_GUIDANCE[t]}`),
      ].join("\n")
    : "";

  return { suggestedTools, toolAnnotations };
}
```

#### 1.2 Extended `PromptResult` (`src/shared/types/PromptResult.ts`)

```typescript
// Addition to PromptResult.ts — fully backward-compatible
export interface PromptResult {
  enhancedPrompt: string;
  intent: "ask" | "edit";
  suggestedTools?: CopilotTool[];   // NEW: Copilot tool references
}
```

#### 1.3 Updated System Prompt (`src/core/prompts/SystemPrompts.ts`)

The `OPTIMIZATION` prompt is extended to instruct the model to **embed tool references inside the `enhancedPrompt` text**, not just as metadata:

```typescript
OPTIMIZATION: `You are a prompt engineering expert for GitHub Copilot.
Your task is to rewrite the user's raw prompt into a structured, agent-ready prompt.

Return ONLY a valid JSON object:
{
  "intent": "ask" | "edit",
  "enhancedPrompt": "..."
}

Rules for Intent:
- "edit": code writing, bug fixing, file modification, generating new files, refactoring.
- "ask": questions, explanations, concepts, architectural discussion.

Rules for enhancedPrompt:
- Start with a clear **Task** definition.
- Include **Context** if relevant.
- List **Requirements** as bullet points.
- Define **Output** format expected.
- If tool placement guidance is provided at the end of the user message, embed those Copilot
  tool references (e.g. #file:<path>, #editor, @workspace) INLINE within the sentence where
  each tool is semantically relevant. Do NOT collect them in a trailing "Tools" section.
  Only include a tool reference if it is clearly needed by that specific sentence.

Example of CORRECT inline tool embedding:
**Task**
Inspect #file:src/auth/guard.ts for the null-reference crash and apply a targeted fix.

**Context**
The error is on line 42 of #editor. Use @workspace to check whether any other guard
inherits from this class before modifying the base implementation.

**Requirements**
- Review the surrounding code in #editor for existing null-guard patterns
- After applying the fix, run the test suite via @terminal to confirm no regressions

**Output**
Modified src/auth/guard.ts with the fix applied and all existing tests passing.

Example of INCORRECT style (do not do this):
**Task**
Fix the null-reference crash in the auth guard.

**Tools**          ← wrong: isolated trailing list, no placement context
- #editor
- @workspace

IMPORTANT: Output valid JSON only. Do NOT use markdown code fences.`,
```

---

## Enhancement 2 — Rich Workspace Context Gathering

### Problem

Currently, `buildPromptWithContext()` in `RealtimeModeStrategy.ts` only reads files from `request.references` (things the user explicitly dragged in). It misses the richest source of context: **what VS Code already knows** — the active file, the cursor position, the language, diagnostics, git branch, and workspace structure.

### Goal

Before the LLM call, automatically gather workspace signals and prepend them to the prompt as a structured **Context Preamble**. The LLM receives much more grounded information and produces significantly better-tailored output.

### Context Signals to Gather

| Signal | VS Code API | Value |
|---|---|---|
| Active file path + language | `window.activeTextEditor` | File type, framework inference |
| Cursor line + surrounding code | `editor.document.getText(surroundingRange)` | Pinpoints where the user is working |
| Current selection text | `editor.document.getText(editor.selection)` | User's highlighted code |
| Open file list | `workspace.textDocuments` | Cross-file awareness |
| Workspace diagnostics (errors/warnings) | `languages.getDiagnostics()` | Bug context |
| Git branch name | `vscode.extensions.getExtension('vscode.git')` | Feature branch context |
| Package metadata | `workspace.findFiles('package.json')` | Tech stack |

### Implementation

#### 2.1 Context Gatherer Service (`src/core/services/WorkspaceContextGatherer.ts`)

```typescript
// src/core/services/WorkspaceContextGatherer.ts
import * as vscode from "vscode";

export interface WorkspaceContext {
  activeFile?: {
    path: string;
    language: string;
    cursorLine: number;
    surroundingCode: string;  // ±10 lines around cursor
    selection?: string;       // only if non-empty
  };
  openFiles: string[];        // paths of other open editors
  diagnostics: DiagnosticContext[];
  gitBranch?: string;
  techStack?: string[];       // parsed from package.json / tsconfig / etc.
}

export interface DiagnosticContext {
  file: string;
  line: number;
  severity: "error" | "warning";
  message: string;
}

export class WorkspaceContextGatherer {
  async gather(): Promise<WorkspaceContext> {
    const ctx: WorkspaceContext = { openFiles: [], diagnostics: [] };

    // --- Active editor ---
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      const cursor = editor.selection.active;
      const startLine = Math.max(0, cursor.line - 10);
      const endLine = Math.min(doc.lineCount - 1, cursor.line + 10);
      const surroundingRange = new vscode.Range(startLine, 0, endLine, 0);

      ctx.activeFile = {
        path: vscode.workspace.asRelativePath(doc.uri),
        language: doc.languageId,
        cursorLine: cursor.line + 1,
        surroundingCode: doc.getText(surroundingRange),
      };

      if (!editor.selection.isEmpty) {
        ctx.activeFile.selection = doc.getText(editor.selection);
      }
    }

    // --- Open files (exclude active) ---
    ctx.openFiles = vscode.workspace.textDocuments
      .filter((d) => d.uri.scheme === "file" && d !== editor?.document)
      .map((d) => vscode.workspace.asRelativePath(d.uri))
      .slice(0, 10); // cap at 10 to avoid prompt bloat

    // --- Diagnostics (errors only, active file first) ---
    const allDiagnostics = vscode.languages.getDiagnostics();
    ctx.diagnostics = allDiagnostics
      .flatMap(([uri, diags]) =>
        diags
          .filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning)
          .map((d) => ({
            file: vscode.workspace.asRelativePath(uri),
            line: d.range.start.line + 1,
            severity: d.severity === vscode.DiagnosticSeverity.Error ? "error" : "warning",
            message: d.message,
          } as DiagnosticContext))
      )
      .slice(0, 5); // cap to avoid noise

    // --- Git branch ---
    try {
      const gitExt = vscode.extensions.getExtension("vscode.git");
      if (gitExt?.isActive) {
        const api = gitExt.exports.getAPI(1);
        const repo = api.repositories[0];
        if (repo) {
          ctx.gitBranch = repo.state.HEAD?.name;
        }
      }
    } catch { /* git not available, skip */ }

    // --- Tech stack from package.json ---
    try {
      const pkgFiles = await vscode.workspace.findFiles("package.json", "**/node_modules/**", 1);
      if (pkgFiles.length > 0) {
        const raw = await vscode.workspace.fs.readFile(pkgFiles[0]);
        const pkg = JSON.parse(Buffer.from(raw).toString("utf-8"));
        const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        ctx.techStack = deps.slice(0, 15);
      }
    } catch { /* package.json not found or malformed */ }

    return ctx;
  }

  /**
   * Serialise gathered context into a compact, LLM-readable preamble string.
   */
  formatAsPromptPreamble(ctx: WorkspaceContext): string {
    const lines: string[] = ["### Workspace Context (auto-gathered)"];

    if (ctx.activeFile) {
      lines.push(`**Active File:** \`${ctx.activeFile.path}\` (${ctx.activeFile.language})`);
      lines.push(`**Cursor:** line ${ctx.activeFile.cursorLine}`);
      if (ctx.activeFile.selection) {
        lines.push(`**Selected Text:**\n\`\`\`\n${ctx.activeFile.selection}\n\`\`\``);
      }
      lines.push(`**Code Around Cursor:**\n\`\`\`${ctx.activeFile.language}\n${ctx.activeFile.surroundingCode}\n\`\`\``);
    }

    if (ctx.openFiles.length > 0) {
      lines.push(`**Other Open Files:** ${ctx.openFiles.join(", ")}`);
    }

    if (ctx.diagnostics.length > 0) {
      lines.push(`**Diagnostics:**`);
      ctx.diagnostics.forEach((d) =>
        lines.push(`  - [${d.severity.toUpperCase()}] ${d.file}:${d.line} — ${d.message}`)
      );
    }

    if (ctx.gitBranch) {
      lines.push(`**Git Branch:** \`${ctx.gitBranch}\``);
    }

    if (ctx.techStack && ctx.techStack.length > 0) {
      lines.push(`**Tech Stack:** ${ctx.techStack.join(", ")}`);
    }

    return lines.join("\n");
  }
}
```

#### 2.2 Wire into `RealtimeModeStrategy.buildPromptWithContext()`

```typescript
// Updated buildPromptWithContext() in RealtimeModeStrategy.ts
private async buildPromptWithContext(
  prompt: string,
  request: vscode.ChatRequest,
): Promise<string> {
  const parts: string[] = [];

  // --- Enhancement 2: Gather rich workspace context ---
  const wsCtx = await this.contextGatherer.gather();
  const preamble = this.contextGatherer.formatAsPromptPreamble(wsCtx);
  if (preamble) {
    parts.push(preamble);
  }

  // --- Enhancement 3: Resolve explicit VS Code references (#file, #selection…) ---
  if (request.references && request.references.length > 0) {
    const resolved = await this.referenceResolver.resolve(request.references);
    if (resolved) parts.push(resolved);
  }

  // --- Original user prompt ---
  parts.push(`### User Request\n${prompt}`);

  return parts.join("\n\n");
}
```

---

## Enhancement 3 — VS Code Tool Reference Mapping

### Problem

When a user types `#file:src/auth.ts` or `#selection` in the Copilot Chat prompt, these are VS Code **chat variables**. The current `buildPromptWithContext()` partially handles raw `vscode.Uri` references, but:

1. It doesn't handle `#selection` (maps to `vscode.Location`)
2. It doesn't parse **inline reference tokens** typed directly in the prompt text (e.g. `check #file:src/foo.ts for the bug`)
3. It doesn't enrich the enhanced prompt with the **resolved content** so the LLM sees actual code instead of a token

### Goal

Detect and resolve all VS Code tool references — both from `request.references` (drag-and-drop, autocomplete) **and** from inline tokens typed in the prompt — and embed their resolved content into the enhanced prompt.

### VS Code Reference Types

```
From request.references (vscode.ChatPromptReference):
  ref.value instanceof vscode.Uri       → #file:<path> (full file)
  ref.value instanceof vscode.Location  → #selection or range reference
  typeof ref.value === "string"         → @workspace answer snippet

Inline tokens in prompt text:
  #file:<relative-path>                 → resolve and read file
  #selection                            → read current editor selection
  #editor                               → read full active editor content
  #terminalLastCommand                  → read last terminal command output
```

### Implementation

#### 3.1 Reference Resolver (`src/core/services/ReferenceResolver.ts`)

```typescript
// src/core/services/ReferenceResolver.ts
import * as vscode from "vscode";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import { ILogger } from "../../shared/interfaces/ILogger";

export interface ResolvedReference {
  label: string;         // Human-readable name (e.g., "src/auth.ts")
  content: string;       // Actual file/selection text
  type: "file" | "selection" | "editor" | "terminal" | "snippet";
}

export class ReferenceResolver {
  constructor(
    private fileSystem: IFileSystem,
    private logger: ILogger,
  ) {}

  /**
   * Resolves explicit references from request.references (drag-dropped files,
   * autocomplete-selected variables, etc.)
   */
  async resolve(refs: readonly vscode.ChatPromptReference[]): Promise<string> {
    const resolved: ResolvedReference[] = [];

    for (const ref of refs) {
      if (ref.value instanceof vscode.Uri) {
        // #file:<path>
        try {
          const content = await this.fileSystem.readFile(ref.value);
          const label = vscode.workspace.asRelativePath(ref.value);
          resolved.push({ label, content, type: "file" });
        } catch {
          this.logger.warn(`Could not read file reference: ${ref.value.fsPath}`);
        }
      } else if (ref.value instanceof vscode.Location) {
        // #selection or a range in a file
        try {
          const doc = await vscode.workspace.openTextDocument(ref.value.uri);
          const text = doc.getText(ref.value.range);
          const label = `${vscode.workspace.asRelativePath(ref.value.uri)}:${ref.value.range.start.line + 1}`;
          resolved.push({ label, content: text, type: "selection" });
        } catch {
          this.logger.warn(`Could not read location reference`);
        }
      } else if (typeof ref.value === "string") {
        resolved.push({ label: ref.id ?? "snippet", content: ref.value, type: "snippet" });
      }
    }

    return this.formatResolved(resolved);
  }

  /**
   * Parses inline reference tokens typed directly in the prompt text.
   * e.g., "fix the bug in #file:src/auth.ts" or "use #editor to check this"
   */
  async resolveInlineTokens(prompt: string): Promise<{
    cleanPrompt: string;          // Prompt with tokens removed/replaced
    resolved: ResolvedReference[];
  }> {
    const resolved: ResolvedReference[] = [];
    let cleanPrompt = prompt;

    // Pattern: #file:<path>
    const fileTokenRe = /#file:(\S+)/g;
    for (const match of prompt.matchAll(fileTokenRe)) {
      const relativePath = match[1];
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (wsFolder) {
        const uri = vscode.Uri.joinPath(wsFolder.uri, relativePath);
        try {
          const content = await this.fileSystem.readFile(uri);
          resolved.push({ label: relativePath, content, type: "file" });
          cleanPrompt = cleanPrompt.replace(match[0], `\`${relativePath}\``);
        } catch {
          this.logger.warn(`Inline #file token: could not read ${relativePath}`);
        }
      }
    }

    // Pattern: #selection
    if (/#selection\b/i.test(prompt)) {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) {
        const text = editor.document.getText(editor.selection);
        resolved.push({ label: "selection", content: text, type: "selection" });
        cleanPrompt = cleanPrompt.replace(/#selection\b/gi, "the selected code");
      }
    }

    // Pattern: #editor
    if (/#editor\b/i.test(prompt)) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const text = editor.document.getText();
        const label = vscode.workspace.asRelativePath(editor.document.uri);
        resolved.push({ label, content: text, type: "editor" });
        cleanPrompt = cleanPrompt.replace(/#editor\b/gi, `file \`${label}\``);
      }
    }

    // Pattern: #terminalLastCommand
    if (/#terminalLastCommand\b/i.test(prompt)) {
      // VS Code doesn't expose terminal content via API directly.
      // We note it for the enhanced prompt so Copilot natively fetches it.
      // The token is preserved so Copilot resolves it server-side.
      resolved.push({
        label: "terminalLastCommand",
        content: "[Resolved by Copilot at runtime]",
        type: "terminal",
      });
    }

    return { cleanPrompt, resolved };
  }

  private formatResolved(resolved: ResolvedReference[]): string {
    if (resolved.length === 0) return "";

    return resolved
      .map((r) => {
        const lang = r.type === "file" ? this.inferLanguage(r.label) : "";
        return `### Reference: \`${r.label}\`\n\`\`\`${lang}\n${r.content}\n\`\`\``;
      })
      .join("\n\n");
  }

  private inferLanguage(filename: string): string {
    const ext = filename.split(".").pop() ?? "";
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      py: "python", go: "go", rs: "rust", java: "java",
      md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
      css: "css", html: "html", sh: "bash",
    };
    return map[ext] ?? "";
  }
}
```

#### 3.2 Full Updated `buildPromptWithContext()` in `RealtimeModeStrategy.ts`

```typescript
private async buildPromptWithContext(
  prompt: string,
  request: vscode.ChatRequest,
): Promise<string> {
  const parts: string[] = [];

  // Enhancement 2: Workspace context preamble
  const wsCtx = await this.contextGatherer.gather();
  const preamble = this.contextGatherer.formatAsPromptPreamble(wsCtx);
  if (preamble) parts.push(preamble);

  // Enhancement 3a: Resolve inline tokens (#file:, #selection, #editor)
  const { cleanPrompt, resolved: inlineResolved } =
    await this.referenceResolver.resolveInlineTokens(prompt);

  // Enhancement 3b: Resolve drag-and-drop / autocomplete references
  const explicitResolved = request.references?.length
    ? await this.referenceResolver.resolve(request.references)
    : "";

  if (inlineResolved.length > 0) {
    parts.push(this.referenceResolver["formatResolved"](inlineResolved));
  }
  if (explicitResolved) parts.push(explicitResolved);

  // Enhancement 1: Suggest tools and append to prompt preamble
  const { toolAnnotations } = classifyTools(cleanPrompt);

  // User's (cleaned) prompt
  parts.push(`### User Request\n${cleanPrompt}${toolAnnotations}`);

  return parts.join("\n\n");
}
```

---

## Enhancement 4 — MCP-Aware Tool Provisioning

### Problem

Enhancements 1–3 only know about **built-in Copilot tools** (`#file`, `@workspace`, etc.). But many developers run **MCP servers** locally — Postgres MCP, GitHub MCP, Browser MCP, FileSystem MCP, and custom domain-specific servers. The current pipeline has no awareness of these tools. A prompt like *"check the slow query on the dashboard and fix it"* should reference `postgres-mcp.query_db` — but PromptBooster can't suggest what it doesn't know exists.

### Goal

Dynamically discover MCP servers and their tool schemas from the user's workspace configuration, then surface the **most relevant** MCP tools in the enhanced prompt — inline, at the exact sentence where the tool is needed. PromptBooster stays a **prompt optimizer** (never executes MCP tools), but produces prompts that make the downstream agent's tool selection near-instant.

### Design Principles

1. **Discovery, not execution.** PromptBooster reads MCP config files to learn what tools exist. It never calls them.
2. **Pre-filter before injection.** A workspace with 5 MCP servers and 40+ tools must not dump all schemas into the prompt. The classifier pre-filters to the top 3–5 relevant tools per request.
3. **Namespaced references.** MCP tools use `server.tool` format (e.g., `postgres-mcp.query_db`) for unambiguous agent routing.
4. **Graceful degradation.** Zero MCP servers configured → pipeline behaves exactly as Enhancements 1–3.

### MCP Config Discovery Sources

| Source | Location | When available |
|---|---|---|
| Workspace MCP config | `.vscode/mcp.json` | VS Code 1.99+ |
| User settings | `settings.json` → `mcp.servers` | VS Code MCP settings |
| VS Code runtime API | `vscode.lm.tools` | Future (when API stabilizes) |

### Implementation

#### 4.1 MCP Tool Registry (`src/core/services/MCPToolRegistry.ts`)

```typescript
// src/core/services/MCPToolRegistry.ts
import * as vscode from "vscode";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import { ILogger } from "../../shared/interfaces/ILogger";

export interface MCPToolDescriptor {
  serverName: string;           // e.g., "postgres-mcp"
  toolName: string;             // e.g., "query_db"
  qualifiedName: string;        // e.g., "postgres-mcp.query_db"
  description: string;          // from tool schema
  inputSummary?: string;        // simplified input description
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: MCPToolDescriptor[];  // populated after schema fetch
}

export class MCPToolRegistry {
  private catalog: MCPToolDescriptor[] = [];
  private servers: MCPServerConfig[] = [];

  constructor(
    private fileSystem: IFileSystem,
    private logger: ILogger,
  ) {}

  /**
   * Discover MCP servers from workspace config files.
   * Does NOT connect to servers — only reads configuration.
   */
  async discover(): Promise<void> {
    this.servers = [];
    this.catalog = [];

    // Source 1: .vscode/mcp.json
    await this.discoverFromMcpJson();

    // Source 2: VS Code settings (mcp.servers)
    this.discoverFromSettings();

    // Source 3: Runtime API (future)
    await this.discoverFromRuntime();

    this.logger.log(
      `MCPToolRegistry: discovered ${this.servers.length} servers, ` +
      `${this.catalog.length} tools`
    );
  }

  private async discoverFromMcpJson(): Promise<void> {
    try {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) return;

      const mcpJsonUri = vscode.Uri.joinPath(wsFolder.uri, ".vscode", "mcp.json");
      const raw = await this.fileSystem.readFile(mcpJsonUri);
      const config = JSON.parse(raw);

      // Parse servers from mcp.json format
      const servers = config.servers ?? config.mcpServers ?? {};
      for (const [name, serverConfig] of Object.entries(servers)) {
        const sc = serverConfig as any;
        this.servers.push({
          name,
          command: sc.command ?? "",
          args: sc.args,
          env: sc.env,
        });

        // If tool schemas are declared inline (some configs include them)
        if (sc.tools && Array.isArray(sc.tools)) {
          for (const tool of sc.tools) {
            this.catalog.push({
              serverName: name,
              toolName: tool.name,
              qualifiedName: `${name}.${tool.name}`,
              description: tool.description ?? "",
              inputSummary: this.summarizeInput(tool.inputSchema),
            });
          }
        }
      }
    } catch { /* .vscode/mcp.json not found — normal */ }
  }

  private discoverFromSettings(): void {
    const mcpSettings = vscode.workspace.getConfiguration("mcp");
    const servers = mcpSettings.get<Record<string, any>>("servers", {});

    for (const [name, config] of Object.entries(servers)) {
      // Avoid duplicates from mcp.json
      if (this.servers.some((s) => s.name === name)) continue;

      this.servers.push({
        name,
        command: config.command ?? "",
        args: config.args,
      });
    }
  }

  private async discoverFromRuntime(): Promise<void> {
    // Future: use vscode.lm.tools API when stable
    // For now, this is a no-op placeholder
    try {
      // const tools = await vscode.lm.tools.list();
      // ... map to MCPToolDescriptor
    } catch { /* API not available yet */ }
  }

  /** Returns all discovered tools. */
  getToolCatalog(): MCPToolDescriptor[] {
    return this.catalog;
  }

  /** Returns server names only (useful when tools aren't enumerable from config). */
  getServerNames(): string[] {
    return this.servers.map((s) => s.name);
  }

  /**
   * Format the tool catalog as a compact string for injection into the system prompt.
   * Only includes tools from the provided filtered list.
   */
  formatForSystemPrompt(tools: MCPToolDescriptor[]): string {
    if (tools.length === 0) return "";

    const lines = [
      "Available MCP Tools (use ONLY if clearly relevant to the task):",
      ...tools.map((t) =>
        `- \`${t.qualifiedName}\`: ${t.description}${t.inputSummary ? ` (${t.inputSummary})` : ""}`
      ),
      "",
      "If an MCP tool is relevant, embed it inline (e.g., \"run EXPLAIN ANALYZE via",
      "`postgres-mcp.query_db`\") at the exact sentence where the tool is needed.",
    ];
    return lines.join("\n");
  }

  private summarizeInput(schema: any): string | undefined {
    if (!schema?.properties) return undefined;
    const keys = Object.keys(schema.properties).slice(0, 3);
    return keys.length > 0 ? `params: ${keys.join(", ")}` : undefined;
  }
}
```

#### 4.2 Extended Tool Affinity Classifier

The `classifyTools()` function is extended to accept an optional MCP catalog and score MCP tools alongside built-in tools:

```typescript
// Extended signature in ToolAffinityClassifier.ts

export interface MCPToolScore {
  tool: MCPToolDescriptor;
  score: number;
}

export interface ToolAffinityResult {
  suggestedTools: CopilotTool[];
  mcpTools: MCPToolDescriptor[];   // NEW: top relevant MCP tools
  toolAnnotations: string;         // placement guidance (built-in + MCP)
}

export function classifyTools(
  prompt: string,
  mcpCatalog: MCPToolDescriptor[] = [],
): ToolAffinityResult {
  // --- Score built-in tools (existing logic) ---
  const scored: [CopilotTool, number][] = (Object.entries(TOOL_SIGNALS) as [CopilotTool, RegExp[]][])
    .map(([tool, patterns]) => [
      tool,
      patterns.reduce((acc, re) => acc + (re.test(prompt) ? 1 : 0), 0),
    ])
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  const suggestedTools = scored.map(([tool]) => tool);

  // --- Score MCP tools by keyword-matching prompt against description ---
  const promptLower = prompt.toLowerCase();
  const mcpScored: MCPToolScore[] = mcpCatalog
    .map((tool) => {
      const words = tool.description.toLowerCase().split(/\W+/).filter(Boolean);
      const score = words.reduce(
        (acc, word) => acc + (word.length > 3 && promptLower.includes(word) ? 1 : 0),
        0,
      );
      // Also match server name and tool name
      const nameBonus =
        (promptLower.includes(tool.serverName) ? 2 : 0) +
        (promptLower.includes(tool.toolName) ? 2 : 0);
      return { tool, score: score + nameBonus };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);  // hard cap at top 5

  const mcpTools = mcpScored.map(({ tool }) => tool);

  // --- Build combined placement guidance ---
  const builtInGuidance = suggestedTools.map((t) => `- ${TOOL_PLACEMENT_GUIDANCE[t]}`);
  const mcpGuidance = mcpTools.map(
    (t) => `- embed \`${t.qualifiedName}\` in the sentence where ${t.description.toLowerCase()} is needed`
  );

  const allGuidance = [...builtInGuidance, ...mcpGuidance];
  const toolAnnotations = allGuidance.length > 0
    ? [
        "[Tool placement guidance — embed these tool references INLINE within the",
        "enhancedPrompt at the exact sentence where each is relevant. Do NOT collect them in",
        "a separate section.]",
        ...allGuidance,
      ].join("\n")
    : "";

  return { suggestedTools, mcpTools, toolAnnotations };
}
```

#### 4.3 Extended `PromptResult`

```typescript
export interface PromptResult {
  enhancedPrompt: string;
  intent: "ask" | "edit";
  suggestedTools?: CopilotTool[];           // Built-in Copilot tools
  mcpTools?: { server: string; tool: string }[];  // MCP tool references
}
```

#### 4.4 Updated `buildPromptWithContext()` (Final Version)

```typescript
private async buildPromptWithContext(
  prompt: string,
  request: vscode.ChatRequest,
): Promise<string> {
  const parts: string[] = [];

  // Enhancement 2: Workspace context preamble
  const wsCtx = await this.contextGatherer.gather();
  const preamble = this.contextGatherer.formatAsPromptPreamble(wsCtx);
  if (preamble) parts.push(preamble);

  // Enhancement 3a: Resolve inline tokens (#file:, #selection, #editor)
  const { cleanPrompt, resolved: inlineResolved } =
    await this.referenceResolver.resolveInlineTokens(prompt);

  // Enhancement 3b: Resolve drag-and-drop / autocomplete references
  const explicitResolved = request.references?.length
    ? await this.referenceResolver.resolve(request.references)
    : "";

  if (inlineResolved.length > 0) {
    parts.push(this.referenceResolver["formatResolved"](inlineResolved));
  }
  if (explicitResolved) parts.push(explicitResolved);

  // Enhancement 4: Discover MCP tools and inject catalog into prompt
  await this.mcpToolRegistry.discover();
  const mcpCatalog = this.mcpToolRegistry.getToolCatalog();

  // Enhancement 1 + 4: Classify both built-in and MCP tools
  const { toolAnnotations, mcpTools } = classifyTools(cleanPrompt, mcpCatalog);

  // If MCP tools matched, inject their catalog for LLM awareness
  if (mcpTools.length > 0) {
    parts.push(this.mcpToolRegistry.formatForSystemPrompt(mcpTools));
  }

  // User's (cleaned) prompt + tool placement guidance
  parts.push(`### User Request\n${cleanPrompt}${toolAnnotations ? "\n\n" + toolAnnotations : ""}`);

  return parts.join("\n\n");
}
```

---

## Integration Points in the Codebase

| New File / Change | Location | Purpose |
|---|---|---|
| **NEW** `ToolAffinityClassifier.ts` | `src/core/services/` | Enhancement 1: Tool signal detection |
| **NEW** `WorkspaceContextGatherer.ts` | `src/core/services/` | Enhancement 2: VS Code context gathering |
| **NEW** `ReferenceResolver.ts` | `src/core/services/` | Enhancement 3: Reference token resolution |
| **NEW** `MCPToolRegistry.ts` | `src/core/services/` | Enhancement 4: MCP server discovery + tool catalog |
| **EDIT** `PromptResult.ts` | `src/shared/types/` | Add `suggestedTools?` and `mcpTools?` fields |
| **EDIT** `SystemPrompts.ts` | `src/core/prompts/` | Add inline tool embedding + MCP tool catalog instructions |
| **EDIT** `RealtimeModeStrategy.ts` | `src/core/strategies/` | Wire all four enhancements into `buildPromptWithContext()` |
| **EDIT** `ToolAffinityClassifier.ts` | `src/core/services/` | Accept MCP catalog, score MCP tools alongside built-ins |
| **EDIT** `TYPES` / DI container | `src/di/` | Register all new services |

---

## Implementation Phases

### Phase 1 — Tool-Aware Prompt (Enhancement 1)

Lowest risk, highest immediate value. No new dependencies.

- [ ] Create `ToolAffinityClassifier.ts` with signal map
- [ ] Update `SYSTEM_PROMPTS.OPTIMIZATION` to include inline tool embedding instructions
- [ ] Extend `PromptResult` with `suggestedTools?`
- [ ] Update `RealtimeModeStrategy` to call `classifyTools()` and append `toolAnnotations`
- [ ] Update `renderInteractiveResponse()` to display detected tool tags in the UI

### Phase 2 — Rich Context Gathering (Enhancement 2)

Medium scope. Requires new service and DI registration.

- [ ] Create `WorkspaceContextGatherer.ts`
- [ ] Register in DI container (`TYPES.WorkspaceContextGatherer`)
- [ ] Inject into `RealtimeModeStrategy` constructor
- [ ] Replace the basic context building with the new preamble format
- [ ] Test with a variety of file types and project structures

### Phase 3 — Reference Resolution (Enhancement 3)

Highest scope. Builds on Phase 2.

- [ ] Create `ReferenceResolver.ts`
- [ ] Register in DI container (`TYPES.ReferenceResolver`)
- [ ] Inject into `RealtimeModeStrategy` constructor
- [ ] Handle `request.references` array (already partially done — replace existing logic)
- [ ] Add inline token parsing (`#file:`, `#selection`, `#editor`)
- [ ] Handle the `#terminalLastCommand` case gracefully (preserve token for Copilot)
- [ ] Ensure file content is truncated if it exceeds a safe token budget (~8k chars per file)

### Phase 4 — MCP-Aware Tool Provisioning (Enhancement 4)

Builds on Phase 1. Requires MCP config parsing.

- [ ] Create `MCPToolRegistry.ts` with config file discovery
- [ ] Register in DI container (`TYPES.MCPToolRegistry`)
- [ ] Extend `ToolAffinityClassifier.classifyTools()` to accept an MCP tool catalog
- [ ] Score MCP tools by keyword-matching prompt against `tool.description`
- [ ] Inject filtered MCP tool catalog into `OPTIMIZATION` system prompt dynamically
- [ ] Extend `PromptResult` with `mcpTools?` field
- [ ] Add runtime discovery via VS Code `lm.tools` API when available
- [ ] Test with 0, 1, and 5+ MCP servers configured

---

## Before / After Examples

### Example 1: Built-in Tools (Enhancements 1–3)

**User types:**

```
check #file:src/auth/guard.ts for the null ref crash in #selection and fix it
```

**Before (current behavior):**

```
enhancedPrompt: "Task: Fix a null reference crash in the auth guard. ..."
```

— No file content, no selection, no tool hints.

**After (with Enhancements 1–3 + inline tool embedding):**

*What the LLM receives (prompt sent to optimizer):*

```
### Workspace Context (auto-gathered)
**Active File:** `src/auth/guard.ts` (typescript)
**Cursor:** line 42
**Git Branch:** `fix/auth-null-ref`
**Tech Stack:** typescript, express, typeorm, jest
**Diagnostics:**
  - [ERROR] src/auth/guard.ts:42 — Object is possibly 'undefined'.

### Reference: `src/auth/guard.ts`
```typescript
// ... full file content ...
```

### Reference: `selection`

```typescript
// ... user-selected code block ...
```

### User Request

check `src/auth/guard.ts` for the null ref crash in the selected code and fix it

[Tool placement guidance — embed these tool references INLINE within the
enhancedPrompt at the exact sentence where each is relevant. Do NOT collect them in
a separate section.]

- embed #file:<path> in the Task or Context sentence that names the specific file
- embed #editor in any sentence that refers to the full content of the active file
- embed @workspace in Requirements that involve cross-file lookup or navigation

```

*What the LLM produces as `enhancedPrompt`:*
```

**Task**
Inspect #file:src/auth/guard.ts for the null-reference crash in #selection and apply
a targeted, minimal fix.

**Context**
A TypeScript diagnostic confirms `Object is possibly 'undefined'` on line 42 of #editor.
The selected code above shows the exact location of the unguarded property access.
Use @workspace to verify whether this guard class is extended elsewhere before modifying it.

**Requirements**

- Identify the property access that lacks a null-safe check in #editor
- Apply a null-safe check (optional chaining or early return) that matches
  the existing coding style visible in #file:src/auth/guard.ts
- Confirm no other files in @workspace depend on the current (unsafe) behaviour

**Output**
Modified `src/auth/guard.ts` with the fix applied and a brief explanation of the change.

```

### Example 2: MCP-Aware Tools (Enhancement 4)

**User types:**

```

the user dashboard is slow, analyze the query and fix it, then push a PR

```

**User's `.vscode/mcp.json` contains:** `postgres-mcp`, `github-mcp`

*What the LLM receives (prompt sent to optimizer):*

```

### Workspace Context (auto-gathered)

**Active File:** `src/data/userDashboard.ts` (typescript)
**Cursor:** line 87
**Git Branch:** `perf/dashboard-query`
**Tech Stack:** typescript, express, typeorm, pg

Available MCP Tools (use ONLY if clearly relevant to the task):

- `postgres-mcp.query_db`: Execute SQL queries against the project database
- `postgres-mcp.list_tables`: List available database tables and schemas
- `github-mcp.create_pull_request`: Create a pull request on GitHub

### User Request

the user dashboard is slow, analyze the query and fix it, then push a PR

[Tool placement guidance — embed these tool references INLINE within the
enhancedPrompt at the exact sentence where each is relevant. Do NOT collect them in
a separate section.]

- embed #file:<path> in the Task or Context sentence that names the specific file
- embed #terminalLastCommand in the Context sentence that references the error output
- embed `postgres-mcp.query_db` in the sentence where executing sql queries against the project database is needed
- embed `github-mcp.create_pull_request` in the sentence where creating a pull request on github is needed

```

*What the LLM produces as `enhancedPrompt`:*
```

**Task**
Diagnose the slow query powering the user dashboard in #file:src/data/userDashboard.ts
and optimize it for production performance.

**Context**
Run EXPLAIN ANALYZE on the dashboard query via `postgres-mcp.query_db` to identify
missing indexes or full table scans. Check #terminalLastCommand for recent slow-query
warnings.

**Requirements**

- Use `postgres-mcp.query_db` to profile the current SQL and capture the execution plan
- Apply the fix (add index, rewrite query, or optimize join) in #file:src/data/userDashboard.ts
- Verify the fix by re-running the query via `postgres-mcp.query_db` and confirming improved timing
- Use @workspace to check if other data layer files share the same query pattern
- Once verified, create a PR via `github-mcp.create_pull_request` with a summary of the change

**Output**
Optimized `src/data/userDashboard.ts` with the fix applied. PR created with before/after
query timings in the description.

```

> **Note:** Built-in tools (`#file:`, `@workspace`) and MCP tools (`postgres-mcp.query_db`,
> `github-mcp.create_pull_request`) appear inline at the exact sentence where the agent needs
> each capability. The agent resolves each reference in-context — no separate tools section.
