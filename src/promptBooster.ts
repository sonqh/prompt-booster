/**
 * Core prompt optimization logic
 */

import * as vscode from "vscode";

export class PromptOptimizer {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  async optimize(
    prompt: string,
    model: vscode.LanguageModelChat,
    cancellationToken?: vscode.CancellationToken,
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt();

    this.outputChannel.appendLine("Starting prompt optimization...");
    this.outputChannel.appendLine(
      `Original prompt length: ${prompt.length} characters`,
    );

    try {
      const messages = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(prompt),
      ];

      const request = await model.sendRequest(messages, {}, cancellationToken);

      let result = "";
      for await (const chunk of request.text) {
        result += chunk;
      }

      result = result.trim();

      this.outputChannel.appendLine(
        `Optimized prompt length: ${result.length} characters`,
      );
      this.outputChannel.appendLine("Optimization completed successfully");

      return result;
    } catch (error) {
      this.outputChannel.appendLine(`Optimization error: ${error}`);

      if (error instanceof vscode.CancellationError) {
        throw new Error("Optimization cancelled by user");
      }

      throw new Error(
        `Failed to optimize prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildSystemPrompt(): string {
    return `You are a prompt optimization assistant. Enhance the following prompt by:

- Making instructions explicit and unambiguous
- Adding relevant context and constraints
- Removing redundancy while preserving intent
- Using proper Markdown formatting for better readability
- Organizing requirements as clear bulleted or numbered lists
- Adding specific details where instructions are vague
- Structuring the prompt with logical sections if complex

IMPORTANT: Return ONLY the enhanced prompt text. Do not include any explanations, meta-commentary, or notes about what you changed. The output should be ready to use as-is.`;
  }

  async optimizeWithProgress(
    prompt: string,
    model: vscode.LanguageModelChat,
    progressTitle: string = "Optimizing prompt...",
  ): Promise<string | undefined> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: progressTitle,
        cancellable: true,
      },
      async (progress, token) => {
        try {
          progress.report({ message: "Sending to AI model..." });

          const result = await this.optimize(prompt, model, token);

          progress.report({ message: "Complete!" });
          return result;
        } catch (error) {
          if (error instanceof Error && error.message.includes("cancelled")) {
            vscode.window.showInformationMessage("Optimization cancelled");
            return undefined;
          }
          throw error;
        }
      },
    );
  }
}
