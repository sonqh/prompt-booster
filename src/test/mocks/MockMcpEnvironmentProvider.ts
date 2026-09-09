/**
 * Mock IMcpEnvironmentProvider — makes MCPToolRegistry tests hermetic:
 * no ambient `vscode.workspace`, no real home directory. Tests point the
 * mock at `/mock/workspace` and `/mock/home` and inject file contents via
 * MockFileSystem.
 */
import { IMcpEnvironmentProvider } from "../../shared/interfaces/IMcpEnvironmentProvider";

export class MockMcpEnvironmentProvider implements IMcpEnvironmentProvider {
  public workspaceFolderPath: string | undefined = "/mock/workspace";
  public homeDirPath: string = "/mock/home";
  public vsCodeServerSettings: Record<string, unknown> = {};
  public vsCodeDisabledServers: Set<string> = new Set();

  getWorkspaceFolderPath(): string | undefined {
    return this.workspaceFolderPath;
  }

  getVsCodeServerSettings(): Record<string, unknown> {
    return this.vsCodeServerSettings;
  }

  getVsCodeDisabledServers(): Set<string> {
    return this.vsCodeDisabledServers;
  }

  getHomeDirPath(): string {
    return this.homeDirPath;
  }
}
