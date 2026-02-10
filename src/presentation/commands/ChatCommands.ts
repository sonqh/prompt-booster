/**
 * Chat Helper Commands - Commands called from chat UI buttons
 */
import * as vscode from "vscode";
import { FileModeStrategy } from "../../core/strategies/FileModeStrategy";
import { ILogger } from "../../shared/interfaces/ILogger";

export class ChatCommandsHandler {
  constructor(
    private fileModeStrategy: FileModeStrategy,
    private logger: ILogger,
  ) {}

  async runPrompt(prompt: string): Promise<void> {
    this.logger.log("ChatCommands: runPrompt");

    try {
      // Copy to clipboard as fallback
      await vscode.env.clipboard.writeText(prompt);

      // Try to open chat with prompt
      const success = await vscode.commands.executeCommand(
        "workbench.action.chat.open",
        { query: prompt },
      );

      if (!success) {
        vscode.window.showInformationMessage(
          "Prompt copied to clipboard. Paste it in Copilot Chat.",
        );
      }
    } catch (error) {
      this.logger.error("runPrompt failed", error as Error);
      vscode.window.showErrorMessage(
        `Failed to run prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createPromptFile(original: string, optimized: string): Promise<void> {
    this.logger.log("ChatCommands: createPromptFile");

    try {
      const filePath = await this.fileModeStrategy.generatePromptFile(
        original,
        optimized,
      );

      if (filePath) {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(
          "Prompt file created successfully",
        );
      }
    } catch (error) {
      this.logger.error("createPromptFile failed", error as Error);
      vscode.window.showErrorMessage(
        `Failed to create prompt file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "promptBooster.runPrompt",
        (prompt: string) => this.runPrompt(prompt),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "promptBooster.createPromptFile",
        (original: string, optimized: string) =>
          this.createPromptFile(original, optimized),
      ),
    );
  }
}
