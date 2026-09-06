/**
 * UsePromptVersionCommand (Phase E1) — "PromptBooster: Use This Prompt Version"
 *
 * The edit path's real "apply" affordance (not pure telemetry): invoked from
 * the "✓ Use This Version" code lens on a feedback-tagged .prompt.md file, it
 *  1. extracts the PromptBooster-Feedback-Id from the leading header comment,
 *  2. computes the final text by stripping HTML comments (identical rule to
 *     FileModeStrategy.processPromptFile),
 *  3. finalizes the edit-path feedback record (per-ref retained/removed
 *     labels are derived there), and
 *  4. sends the final text to Copilot Chat, with clipboard fallback —
 *     mirroring processPromptFile's behavior.
 */
import * as vscode from "vscode";
import {
  IPromptFeedbackLog,
  extractFeedbackId,
  stripHtmlComments,
} from "../../core/services/PromptFeedbackLog";
import { ILogger } from "../../shared/interfaces/ILogger";

export class UsePromptVersionCommand {
  constructor(
    private promptFeedbackLog: IPromptFeedbackLog,
    private logger: ILogger,
  ) {}

  async execute(document?: vscode.TextDocument): Promise<void> {
    const doc = document ?? vscode.window.activeTextEditor?.document;
    if (!doc) {
      this.logger.log("UsePromptVersion: no active document");
      return;
    }
    if (!doc.fileName.endsWith(".prompt.md")) return;

    const content = doc.getText();
    const finalText = stripHtmlComments(content);
    if (!finalText) {
      vscode.window.showWarningMessage(
        "Prompt file is empty after removing comments",
      );
      return;
    }

    // Finalize the edit-path feedback record (fire-and-forget posture — a
    // logging/persistence failure must not block the user's apply click).
    const feedbackId = extractFeedbackId(content);
    if (feedbackId) {
      try {
        this.promptFeedbackLog.finalizeEdit(feedbackId, finalText);
        this.logger.log(
          `UsePromptVersion: finalized feedback ${feedbackId} with the edited text`,
        );
      } catch (error) {
        this.logger.warn(
          `UsePromptVersion: finalizing feedback failed (${
            error instanceof Error ? error.message : String(error)
          })`,
        );
      }
    }

    try {
      const success = await vscode.commands.executeCommand(
        "workbench.action.chat.open",
        { query: finalText },
      );
      if (!success) {
        vscode.window.showInformationMessage(
          "Prompt copied to clipboard. Paste it in Copilot Chat.",
        );
        await vscode.env.clipboard.writeText(finalText);
      }
    } catch (error) {
      this.logger.error("UsePromptVersion: sending to chat failed", error as Error);
      vscode.window.showErrorMessage(
        `Failed to send prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "promptBooster.usePromptVersion",
        (document?: vscode.TextDocument) => this.execute(document),
      ),
    );
  }
}
