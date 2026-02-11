/**
 * File system interface - abstraction for file operations
 */
export interface IFileSystem {
  /**
   * Read file contents
   */
  readFile(path: string): Promise<string>;

  /**
   * Write file contents
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Check if file exists
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * Create directory
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Get workspace folder path
   */
  getWorkspacePath(): string | undefined;

  /**
   * Join path segments
   */
  joinPath(...segments: string[]): string;
}
