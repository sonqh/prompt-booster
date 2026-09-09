/**
 * Port for environment facts MCP discovery needs from the host.
 *
 * Replaces the direct `vscode` import in MCPToolRegistry (layering violation).
 * Implemented by `src/infrastructure/vscode/VSCodeMcpEnvironmentProvider`;
 * mocked by `MockMcpEnvironmentProvider` in unit tests.
 */
export interface IMcpEnvironmentProvider {
  /** Absolute path of the first workspace folder, if any. */
  getWorkspaceFolderPath(): string | undefined;

  /** Contents of the VS Code `mcp.servers` configuration section (unparsed entries). */
  getVsCodeServerSettings(): Record<string, unknown>;

  /** Server names explicitly disabled in VS Code MCP settings. */
  getVsCodeDisabledServers(): Set<string>;

  /** User home directory (for global config sources like ~/.claude.json). */
  getHomeDirPath(): string;
}
