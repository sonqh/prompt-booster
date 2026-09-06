/**
 * Adapter for IMcpEnvironmentProvider — supplies the environment facts
 * MCPToolRegistry used to read from `vscode` directly (the layering violation
 * fixed by Enhancement 4 v2). Everything here is read-only and defensive:
 * missing workspace/settings degrade to empty values, never throw.
 */
import * as vscode from "vscode";
import * as os from "os";
import { IMcpEnvironmentProvider } from "../../shared/interfaces/IMcpEnvironmentProvider";

export class VSCodeMcpEnvironmentProvider implements IMcpEnvironmentProvider {
  getWorkspaceFolderPath(): string | undefined {
    // Multi-root workspaces: first folder only (existing, documented behavior).
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  getVsCodeServerSettings(): Record<string, unknown> {
    try {
      const servers = vscode.workspace
        .getConfiguration("mcp")
        .get<Record<string, unknown>>("servers", {});
      return servers && typeof servers === "object" ? servers : {};
    } catch {
      return {};
    }
  }

  getVsCodeDisabledServers(): Set<string> {
    try {
      const servers = vscode.workspace
        .getConfiguration("mcp")
        .get<Record<string, { disabled?: boolean }>>("servers", {});
      if (!servers || typeof servers !== "object") return new Set<string>();
      return new Set(
        Object.entries(servers)
          .filter(([, cfg]) => cfg && typeof cfg === "object" && cfg.disabled === true)
          .map(([name]) => name),
      );
    } catch {
      return new Set<string>();
    }
  }

  getHomeDirPath(): string {
    return os.homedir();
  }
}
