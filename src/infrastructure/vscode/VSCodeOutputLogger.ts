/**
 * VS Code Output Logger - implements ILogger interface
 */
import * as vscode from "vscode";
import { ILogger } from "../../shared/interfaces/ILogger";

export class VSCodeOutputLogger implements ILogger {
  private outputChannel: vscode.OutputChannel;

  constructor(channelName: string = "PromptBooster") {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  error(message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
    if (error) {
      this.outputChannel.appendLine(`  ${error.message}`);
      if (error.stack) {
        this.outputChannel.appendLine(`  ${error.stack}`);
      }
    }
  }

  warn(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] WARNING: ${message}`);
  }

  debug(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] DEBUG: ${message}`);
  }

  show(): void {
    this.outputChannel.show();
  }

  /**
   * Get the underlying VS Code output channel
   * (for backwards compatibility during migration)
   */
  getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }

  /**
   * Dispose of the output channel
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}
