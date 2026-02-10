/**
 * VS Code File System - implements IFileSystem interface
 */
import * as vscode from "vscode";
import * as path from "path";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";

export class VSCodeFileSystem implements IFileSystem {
  async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString("utf8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const buffer = Buffer.from(content, "utf8");
    await vscode.workspace.fs.writeFile(uri, buffer);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    const uri = vscode.Uri.file(dirPath);
    await vscode.workspace.fs.createDirectory(uri);
  }

  getWorkspacePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath;
  }

  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }
}
