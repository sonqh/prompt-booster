/**
 * Port for MCP config-change notifications, so MCPToolRegistry can invalidate
 * its catalog cache without importing vscode. Implemented by
 * `src/infrastructure/vscode/VSCodeConfigWatcher` (FileSystemWatcher over the
 * known config paths + onDidChangeConfiguration for mcp.* / promptBooster.mcp.*).
 */
export interface IDisposable {
  dispose(): void;
}

export interface IConfigChangeWatcher {
  /**
   * Subscribe to config changes relevant to MCP discovery. The callback is
   * invoked with no arguments; consumers re-fingerprint sources to decide
   * whether anything actually changed.
   *
   * @returns a disposable to unregister the callback (host registers
   * `watcher.dispose()` into `context.subscriptions`).
   */
  onConfigChanged(listener: () => void): IDisposable;

  /** Stop watching entirely. */
  dispose(): void;
}
