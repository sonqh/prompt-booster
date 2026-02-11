/**
 * Logger interface - abstraction for logging operations
 */
export interface ILogger {
  /**
   * Log an informational message
   */
  log(message: string): void;

  /**
   * Log an error message
   */
  error(message: string, error?: Error): void;

  /**
   * Log a warning message
   */
  warn(message: string): void;

  /**
   * Log a debug message
   */
  debug(message: string): void;

  /**
   * Show the log output to the user
   */
  show(): void;
}
