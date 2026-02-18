/**
 * VS Code File System - implements IFileSystem interface
 */
import * as vscode from "vscode";
import * as path from "path";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";

export class VSCodeFileSystem implements IFileSystem {
  async readFile(filePath: string | vscode.Uri): Promise<string> {
    const uri = this.toUri(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString("utf8");
  }

  async writeFile(
    filePath: string | vscode.Uri,
    content: string,
  ): Promise<void> {
    const uri = this.toUri(filePath);
    const buffer = Buffer.from(content, "utf8");
    await vscode.workspace.fs.writeFile(uri, buffer);
  }

  async fileExists(filePath: string | vscode.Uri): Promise<boolean> {
    try {
      const uri = this.toUri(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(dirPath: string | vscode.Uri): Promise<void> {
    const uri = this.toUri(dirPath);
    await vscode.workspace.fs.createDirectory(uri);
  }

  private toUri(path: string | vscode.Uri): vscode.Uri {
    if (path instanceof vscode.Uri) {
      return path;
    }
    return vscode.Uri.file(path);
  }

  getWorkspacePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath;
  }

  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }
}
