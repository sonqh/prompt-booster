/**
 * Chat Helper Commands - Commands called from chat UI buttons
 *
 * Phase E1: the button arguments gained trailing, OPTIONAL feedback
 * parameters ([text, feedbackId, outcome] for runPrompt; [original,
 * optimized, feedbackId] for createPromptFile). The commands keep working
 * when invoked without them (no feedback recorded, graceful).
 */
import * as vscode from "vscode";
import { FileModeStrategy } from "../../core/strategies/FileModeStrategy";
import { IPromptFeedbackLog } from "../../core/services/PromptFeedbackLog";
import { ILogger } from "../../shared/interfaces/ILogger";

export class ChatCommandsHandler {
  constructor(
    private fileModeStrategy: FileModeStrategy,
    private logger: ILogger,
    private promptFeedbackLog?: IPromptFeedbackLog,
  ) {}

  /**
   * Send a prompt to Copilot Chat. When a feedbackId + outcome are supplied
   * (chat buttons), the pending feedback record is resolved first.
   */
  async runPrompt(
    prompt: string,
    feedbackId?: string,
    outcome?: "accept" | "reject",
  ): Promise<void> {
    this.logger.log("ChatCommands: runPrompt");
    this.recordOutcome(feedbackId, outcome);

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

  /**
   * Generate a prompt file for manual refinement. When a feedbackId is
   * supplied, the record is marked edit-opened and the id is embedded in the
   * generated file's header so "Use This Version" can finalize it later.
   */
  async createPromptFile(
    original: string,
    optimized: string,
    feedbackId?: string,
  ): Promise<void> {
    this.logger.log("ChatCommands: createPromptFile");
    this.recordOutcome(feedbackId, "edit-opened");

    try {
      const filePath = await this.fileModeStrategy.generatePromptFile(
        original,
        optimized,
        feedbackId,
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

  /** Fire-and-forget outcome resolution — logged, never surfaced to the user. */
  private recordOutcome(
    feedbackId: string | undefined,
    outcome: "accept" | "reject" | "edit-opened" | undefined,
  ): void {
    if (!feedbackId || !outcome || !this.promptFeedbackLog) return;
    try {
      this.promptFeedbackLog.resolve(feedbackId, outcome);
    } catch (error) {
      this.logger.warn(
        `ChatCommands: recording feedback outcome "${outcome}" failed (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "promptBooster.runPrompt",
        (prompt: string, feedbackId?: string, outcome?: "accept" | "reject") =>
          this.runPrompt(prompt, feedbackId, outcome),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "promptBooster.createPromptFile",
        (original: string, optimized: string, feedbackId?: string) =>
          this.createPromptFile(original, optimized, feedbackId),
      ),
    );
  }
}
