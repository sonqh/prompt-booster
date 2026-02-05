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
    return `You are a prompt expert. Your task is to rewrite the user's raw prompt into a highly effective, structured prompt for an AI coding assistant.

Follow this structure for the enhanced prompt:
**Task**
[A clear, concise title or summary of the objective]

**Context**
[Infer relevant technical context (languages, frameworks, etc.) based on the user's request. If strictly unknown, generic terms are acceptable, but try to be specific based on standard conventions.]

**Requirements**
[Break down the user's request into specific, actionable steps or rules. Use bullet points.]
- Rule 1
- Rule 2...

**Output**
[Specify exactly what the AI should return (e.g., "Return only the code," "Explain the changes," "JSON format," etc.)]

IMPORTANT:
1. Return ONLY the enhanced prompt. Do NOT include any introductory or concluding text.
2. Do NOT answer the prompt yourself. You are only improving the phrasing and structure of the request.
3. If the user's request is very short, expand it with best practices relevant to the topic.
4. Keep the tone professional and direct.`;
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
