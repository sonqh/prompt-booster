# PromptBooster: Tool-Aware Transformation & MCP-Aware Tool Provisioning

This plan implements all four enhancements described in [docs/promptbooster-intelligent-enhancement.md](file:///Users/sonquach/Documents/tools/prompt-booster/docs/promptbooster-intelligent-enhancement.md). The primary deliverables are:

1. **Enhancement 1** — Tool-Aware Prompt Transformation (Copilot built-in tools injected inline)
2. **Enhancement 2** — Rich Workspace Context Gathering (active file, cursor, diagnostics, git, tech stack)
3. **Enhancement 3** — VS Code Reference Resolver (`#file:`, `#selection`, `#editor` tokens resolved before LLM call)
4. **Enhancement 4** — MCP-Aware Tool Provisioning (dynamic discovery of locally-installed MCP servers)

All four are additive and backward-compatible. Existing `PromptResult.intent` / `enhancedPrompt` are preserved.

---

## User Review Required

> [!IMPORTANT]
> **MCP discovery for projects without `.vscode/mcp.json`**
> The spec originally lists only `.vscode/mcp.json` and VS Code settings as discovery sources. You mentioned that projects without that file should also work. The plan below adds a **multi-source discovery waterfall** that checks additional locations before giving up:
>
> | Priority | Source | Location |
> |---|---|---|
> | 1 | VS Code workspace file | `.vscode/mcp.json` |
> | 2 | VS Code user settings | `settings.json → mcp.servers` |
> | 3 | Claude Desktop config | `~/.claude/claude_desktop_config.json` (global) |
> | 4 | Claude Code config | `~/.claude.json` or `.claude/settings.json` |
> | 5 | GitHub Copilot agent config | `.github/copilot/mcp.json` (repo-level) |
> | 6 | Cursor IDE config | `.cursor/mcp.json` (workspace) |
> | 7 | Cline config | `.cline/mcp.json` (workspace-level) |
> | 8 | VS Code runtime API | `vscode.lm.tools` (future, no-op for now) |
>
> If none of these sources have MCP servers, the pipeline degrades gracefully (same as Enhancements 1–3 only).

> [!IMPORTANT]
> **MCP tool enablement validation**
> Simply discovering a server in a config file does not mean it is actually active. `MCPToolRegistry` will perform a lightweight **enablement check** before injecting any tools:
>
> - For `.vscode/mcp.json` and VS Code settings: cross-reference against `vscode.workspace.getConfiguration("mcp")` to verify the server is not explicitly disabled.
> - For non-VS-Code configs (Claude, Cline, Cursor): treat existence in the config as opted-in, but skip servers whose `command` binary is clearly unavailable (optional, best-effort).
> - If a server's tools cannot be confirmed as enabled, they are **omitted** from the injected catalog. The prompt falls back cleanly to built-in Copilot tool suggestions from Enhancement 1.

> [!NOTE]
> Enhancement 2 (WorkspaceContextGatherer) and Enhancement 3 (ReferenceResolver) are dependencies for Enhancement 4's integration into [buildPromptWithContext()](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/strategies/RealtimeModeStrategy.ts#165-201). The phases are designed to be merged in one go but could also be done sequentially.

---

## Proposed Changes

### Enhancement 1 — Tool-Aware Classifier

---

#### [NEW] [ToolAffinityClassifier.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/services/ToolAffinityClassifier.ts)

Pure function module, zero-latency, zero-LLM. Classifies built-in Copilot tools and (optionally) MCP tools by regex/keyword-scoring against the user's prompt.

- Exports `CopilotTool` type, `ToolAffinityResult`, `MCPToolScore`, `classifyTools(prompt, mcpCatalog?)` 
- `TOOL_SIGNALS` map of regexes per built-in tool  
- `TOOL_PLACEMENT_GUIDANCE` for LLM hints  
- MCP scoring: keyword match on `tool.description` + bonus for server/tool name in prompt; capped at top 5

---

#### [MODIFY] [PromptResult.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/shared/types/PromptResult.ts)

Add optional new fields (backward-compatible):

```diff
 export interface PromptResult {
   enhancedPrompt: string;
   intent: "ask" | "edit";
+  suggestedTools?: CopilotTool[];
+  mcpTools?: { server: string; tool: string }[];
 }
```

---

#### [MODIFY] [SystemPrompts.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/prompts/SystemPrompts.ts)

Replace current `OPTIMIZATION` with a more capable `OPTIMIZATION_V2` that instructs the LLM to embed tool references **inline** within `**Task**`, `**Context**`, and `**Requirements**` sentences. The new system prompt includes:

- Instructions for inline tool embedding (not trailing list style)
- Good/bad example in the prompt itself
- Dynamic injection point for MCP tool catalog (provided by `MCPToolRegistry.formatForSystemPrompt()`)

---

### Enhancement 2 — Workspace Context Gatherer

---

#### [NEW] [WorkspaceContextGatherer.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/services/WorkspaceContextGatherer.ts)

Gathers VS Code context before the LLM call:
- Active file path + language, cursor line, ±10 lines surrounding code, selection
- Up to 10 other open files  
- Up to 5 diagnostics (errors/warnings)  
- Git branch (via `vscode.git` extension)  
- Tech stack from [package.json](file:///Users/sonquach/Documents/tools/prompt-booster/package.json) (up to 15 deps)

Serializes via `formatAsPromptPreamble()` into a `### Workspace Context` markdown block.

---

### Enhancement 3 — Reference Resolver

---

#### [NEW] [ReferenceResolver.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/services/ReferenceResolver.ts)

Resolves references from two sources:
1. `request.references` (drag-and-drop / autocomplete): `vscode.Uri` → file content, `vscode.Location` → range text, `string` → snippet
2. Inline tokens typed in the prompt (`#file:<path>`, `#selection`, `#editor`, `#terminalLastCommand`)

Returns resolved content as a `### Reference: <label>` block for each one. File content is truncated to ~8k chars to avoid token budget overflow.

---

### Enhancement 4 — MCP Tool Registry

---

#### [NEW] [MCPToolRegistry.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/services/MCPToolRegistry.ts)

Discovery waterfall (read-only, never executes MCP tools):

```
1. .vscode/mcp.json                        (VS Code workspace)
2. VS Code settings → mcp.servers          (VS Code user config)
3. ~/.claude/claude_desktop_config.json    (Claude Desktop global)
4. ~/.claude.json / .claude/settings.json  (Claude Code)
5. .github/copilot/mcp.json               (GitHub Copilot repo)
6. .cursor/mcp.json                        (Cursor IDE workspace)
7. .cline/mcp.json                         (Cline workspace)
8. vscode.lm.tools API                     (future, no-op now)
```

**Enablement check** — after discovery, each server is validated:
- VS Code sources: compare against `vscode.workspace.getConfiguration("mcp")` disabled list
- Non-VS-Code sources: treat as enabled by default; servers without a resolvable `command` are skipped with a warning
- Disabled / unresolvable servers are excluded from `getToolCatalog()` output

Each source uses `try/catch` with graceful skip. Tool schemas inline in config (if present) are parsed into `MCPToolDescriptor[]`. If no schemas declared in config, servers are still registered (by name only) and available for name-based scoring.

Exports:
- `getToolCatalog()` → `MCPToolDescriptor[]`  
- `getServerNames()` → `string[]`  
- `formatForSystemPrompt(tools)` → compact catalog string for LLM injection

---

### DI Registration

---

#### [MODIFY] [types.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/di/types.ts)

```diff
+  WorkspaceContextGatherer: Symbol.for("WorkspaceContextGatherer"),
+  ReferenceResolver: Symbol.for("ReferenceResolver"),
+  MCPToolRegistry: Symbol.for("MCPToolRegistry"),
```

---

#### [MODIFY] [ServiceRegistry.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/di/ServiceRegistry.ts)

Add three new singleton registrations in [registerCoreServices()](file:///Users/sonquach/Documents/tools/prompt-booster/src/di/ServiceRegistry.ts#108-117). Update [RealtimeModeStrategy](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/strategies/RealtimeModeStrategy.ts#15-210) singleton to inject all three new services.

---

### Wiring into RealtimeModeStrategy

---

#### [MODIFY] [RealtimeModeStrategy.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/strategies/RealtimeModeStrategy.ts)

Constructor gains 3 new deps: `WorkspaceContextGatherer`, `ReferenceResolver`, `MCPToolRegistry`.

Updated [buildPromptWithContext()](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/strategies/RealtimeModeStrategy.ts#165-201) assembly order:

```
1. WorkspaceContextGatherer.gather()     → prepend context preamble
2. ReferenceResolver.resolveInlineTokens(prompt)   → clean prompt + inline refs
3. ReferenceResolver.resolve(request.references)   → drag-and-drop refs
4. MCPToolRegistry.discover()            → populate catalog
5. classifyTools(cleanPrompt, mcpCatalog) → suggestedTools + mcpTools + toolAnnotations
6. MCPToolRegistry.formatForSystemPrompt(mcpTools) → inject catalog block
7. Append "### User Request" + cleanPrompt + toolAnnotations
```

[renderInteractiveResponse()](file:///Users/sonquach/Documents/tools/prompt-booster/src/core/strategies/RealtimeModeStrategy.ts#119-164) updated to show detected MCP tool tags below the intent badge.

---

## Verification Plan

### Automated Tests (TypeScript / Mocha)

Run tests with:
```bash
cd /Users/sonquach/Documents/tools/prompt-booster
npm run compile && npm test
```

#### New test: `src/test/core/ToolAffinityClassifier.test.ts`

Using the `tdd`-style Mocha suite already configured in [src/test/suite/index.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/test/suite/index.ts):

| Test case | Expected outcome |
|---|---|
| `"fix the bug in auth module"` | `#editor` suggested (matches `this file` signal) |
| `"search for all usages of fetchUser"` | `@workspace` suggested |
| `"run the tests and check the output"` | `@terminal` + `#terminalLastCommand` suggested |
| Prompt with MCP catalog `[{postgres-mcp, query_db, "Execute SQL queries"}]` + `"check the slow query"` | `postgres-mcp.query_db` in `mcpTools` |
| Prompt `"fix the bug"` with same catalog | `mcpTools` is `[]` |
| No signals in prompt | `suggestedTools` is `[]`, `mcpTools` is `[]` |

#### New test: `src/test/core/MCPToolRegistry.test.ts`

Uses [MockFileSystem](file:///Users/sonquach/Documents/tools/prompt-booster/src/test/mocks/MockServices.ts#79-110) to inject fake config file content:

| Test case | Expected outcome |
|---|---|
| `.vscode/mcp.json` with 2 servers + inline tool schemas | catalog has 2+ tools |
| `.vscode/mcp.json` not present, `.cline/mcp.json` present | catalog populated from Cline fallback |
| `.vscode/mcp.json` not present, `~/.claude/claude_desktop_config.json` present | catalog populated from Claude Desktop |
| Server present in config but marked disabled in VS Code settings | server excluded from catalog |
| Server present in config with empty `command` | server skipped, no error thrown |
| No config files anywhere | `getToolCatalog()` returns `[]`, `discover()` doesn't throw |
| Duplicate server name across two sources | only registered once |
| `mcp.json` with 5+ servers, each with 10 tools | catalog has all tools; classifier caps injected output at 5 |

#### Updated mock: [src/test/mocks/MockServices.ts](file:///Users/sonquach/Documents/tools/prompt-booster/src/test/mocks/MockServices.ts)

Add `MockMCPToolRegistry` implementing a simple `discover()` + `getToolCatalog()`.

### Compile Check

```bash
cd /Users/sonquach/Documents/tools/prompt-booster
npm run compile
```

TypeScript should compile with 0 errors (strict mode is active per [tsconfig.json](file:///Users/sonquach/Documents/tools/prompt-booster/tsconfig.json)).

### Manual Smoke Test (VS Code Extension Development Host)

1. Open the prompt-booster project in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the host window, open any TypeScript file and place your cursor
4. Open Copilot Chat and type: `@PromptBooster fix the null ref crash in this file`
5. **Expected:** The optimized prompt contains `#editor` or `#file:<path>` **inline** within a sentence — NOT in a trailing tools list
6. Create a `.github/copilot/mcp.json` in the test workspace with a fake server entry:
   ```json
   { "servers": { "my-db": { "command": "node", "args": ["db-mcp.js"], "tools": [{ "name": "query", "description": "Execute SQL queries against the database" }] } } }
   ```
7. Type: `@PromptBooster check why the dashboard query is slow`
8. **Expected:** The optimized prompt references `` `my-db.query` `` inline in a sentence about running SQL
