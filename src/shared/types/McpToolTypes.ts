/**
 * Canonical MCP tool catalog types (Enhancement 4 v2).
 *
 * Single source of truth shared by MCPToolRegistry and ToolAffinityClassifier —
 * ends the previous duplicated descriptor definitions in both files.
 */

/** Where a server entry was discovered from. Order documents dedup priority. */
export type McpConfigSource =
  | "vscode-workspace"
  | "vscode-settings"
  | "vscode-runtime"
  | "github-copilot"
  | "claude-desktop"
  | "claude-code-global"
  | "claude-code-workspace"
  | "cursor"
  | "cline"
  | "manual-index"
  | "probe-cache";

/**
 * Whether the downstream agent (VS Code Copilot agent mode) can be assumed to
 * execute tools from this source. Foreign sources are excluded from injection
 * unless `promptBooster.mcp.includeForeignServers` is enabled.
 */
export type ToolVisibility = "injectable" | "foreign";

/** How the tool list itself was learned. */
export type ToolOrigin = "inline-schema" | "runtime-api" | "probe" | "manual-index";

export interface MCPToolDescriptor {
  serverName: string;            // e.g. "postgres-mcp"
  toolName: string;              // e.g. "query_db"
  qualifiedName: string;         // e.g. "postgres-mcp.query_db" (semantic identifier)
  description: string;
  inputSummary?: string;
  /** True when the server was confirmed present and not disabled in its source. */
  enabled: boolean;
  /** Highest-priority source that advertised this server. */
  source: McpConfigSource;
  /** All sources that advertised this server (dedup-conflict diagnostics). */
  sources: McpConfigSource[];
  /** Derived from `source` via the visibility policy table. */
  visibility: ToolVisibility;
  /** How the tool list was obtained (stubs have no tool list and are not injectable). */
  origin: ToolOrigin;
}
