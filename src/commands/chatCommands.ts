import * as vscode from "vscode";
import { FileMode } from "../modes/fileMode";

/**
 * Commands triggered by chat buttons
 */
export class ChatCommands {
  constructor(
    private fileMode: FileMode,
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Run the prompt in GitHub Copilot Chat
   */
  async runPrompt(prompt: string): Promise<void> {
    try {
      this.outputChannel.appendLine(`Executing prompt via chat: ${prompt.substring(0, 50)}...`);
      
      // Use the workbench command to open chat with the query
      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: prompt,
      });
      
    } catch (error) {
      this.outputChannel.appendLine(`Failed to run prompt: ${error}`);
      vscode.window.showErrorMessage(`Failed to run prompt: ${error}`);
    }
  }

  /**
   * Create a file from the prompt
   */
  async createPromptFile(original: string, optimized: string): Promise<void> {
    try {
        const filePath = await this.fileMode.generatePromptFile(original, optimized);
        if (filePath) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        }
    } catch (error) {
         this.outputChannel.appendLine(`Failed to create prompt file: ${error}`);
         vscode.window.showErrorMessage(`Failed to create prompt file: ${error}`);
    }
  }
}
