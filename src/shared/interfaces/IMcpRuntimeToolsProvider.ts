/**
 * Port for capability-checked access to the VS Code LM tools runtime API
 * (`vscode.lm.tools`, proposed API). Implemented by
 * `src/infrastructure/vscode/VSCodeMcpRuntimeToolsProvider`.
 *
 * This is the PRIMARY discovery source: it returns real descriptions for tools
 * the downstream Copilot agent can actually execute.
 */
export interface IMcpRuntimeTool {
  /** Runtime tool name, e.g. "mcp_postgres-mcp_query_db" for MCP-registered tools. */
  runtimeName: string;
  /** Recovered from `mcp_<server>_<tool>` names where parseable. */
  serverName?: string;
  toolName?: string;
  description: string;
}

export interface IMcpRuntimeToolsProvider {
  /** False when the API is unavailable (not proposed / not enabled) — callers skip silently. */
  isAvailable(): boolean;

  /** Lists currently registered LM tools. Resolves to [] when unavailable. */
  listTools(): Promise<IMcpRuntimeTool[]>;
}
