/**
 * Mock Logger for testing
 */
import { ILogger } from "../../shared/interfaces/ILogger";

export class MockLogger implements ILogger {
  public logs: string[] = [];
  public errors: string[] = [];
  public warnings: string[] = [];

  log(message: string): void {
    this.logs.push(message);
  }

  error(message: string, error?: Error): void {
    this.errors.push(`${message}: ${error?.message}`);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }

  debug(message: string): void {
    this.logs.push(`DEBUG: ${message}`);
  }

  show(): void {
    // no-op
  }
}
