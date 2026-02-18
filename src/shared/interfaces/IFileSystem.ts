import * as vscode from "vscode";

/**
 * File system interface - abstraction for file operations
 */
export interface IFileSystem {
  /**
   * Read file contents
   */
  readFile(path: string | vscode.Uri): Promise<string>;

  /**
   * Write file contents
   */
  writeFile(path: string | vscode.Uri, content: string): Promise<void>;

  /**
   * Check if file exists
   */
  fileExists(path: string | vscode.Uri): Promise<boolean>;

  /**
   * Create directory
   */
  createDirectory(path: string | vscode.Uri): Promise<void>;

  /**
   * Get workspace folder path
   */
  getWorkspacePath(): string | undefined;

  /**
   * Join path segments
   */
  joinPath(...segments: string[]): string;
}
