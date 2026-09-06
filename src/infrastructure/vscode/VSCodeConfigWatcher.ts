/**
 * Adapter for IConfigChangeWatcher — watches the MCP config surface for
 * changes so MCPToolRegistry can invalidate its catalog cache without
 * importing vscode.
 *
 * Watches:
 *   - the workspace config files the registry reads (FileSystemWatcher), and
 *   - `mcp.*` / `promptBooster.mcp.*` settings (onDidChangeConfiguration).
 *
 * Home-directory configs (~/.claude.json) are watched via a RelativePattern
 * rooted at the home dir. The callback carries no payload on purpose:
 * consumers re-fingerprint their sources to decide what actually changed.
 */
import * as vscode from "vscode";
import * as os from "os";
import {
  IDisposable,
  IConfigChangeWatcher,
} from "../../shared/interfaces/IConfigChangeWatcher";

export class VSCodeConfigWatcher implements IConfigChangeWatcher {
  private readonly emitter = new vscode.EventEmitter<void>();
  private disposables: vscode.Disposable[] = [this.emitter];
  private started = false;
  private disposed = false;

  onConfigChanged(listener: () => void): IDisposable {
    this.start();
    const subscription = this.emitter.event(() => listener());
    this.disposables.push(subscription);
    return subscription;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* already disposed */
      }
    }
    this.disposables = [];
  }

  /** Idempotent: watchers are created on first subscription, never before. */
  private start(): void {
    if (this.started) return;
    this.started = true;

    try {
      const workspacePatterns = [
        ".vscode/mcp.json",
        ".cursor/mcp.json",
        ".cline/mcp.json",
        ".github/copilot/mcp.json",
        ".claude/settings.json",
      ];
      for (const pattern of workspacePatterns) {
        this.disposables.push(
          vscode.workspace.createFileSystemWatcher(`**/${pattern}`),
        );
      }

      const home = vscode.Uri.file(os.homedir());
      const homePatterns = [".claude.json", ".claude/claude_desktop_config.json"];
      for (const pattern of homePatterns) {
        this.disposables.push(
          vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(home, pattern),
          ),
        );
      }

      this.disposables.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
          if (
            e.affectsConfiguration("mcp") ||
            e.affectsConfiguration("promptBooster.mcp")
          ) {
            this.emitter.fire();
          }
        }),
      );

      for (const watcher of this.disposables) {
        if (watcher !== this.emitter && "onDidChange" in watcher) {
          const fw = watcher as vscode.FileSystemWatcher;
          fw.onDidChange(() => this.emitter.fire());
          fw.onDidCreate(() => this.emitter.fire());
          fw.onDidDelete(() => this.emitter.fire());
        }
      }
    } catch {
      // Watching is best-effort — mtime fingerprinting still catches changes
      // the watcher misses.
    }
  }
}
