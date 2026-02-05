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
    const { enhancedPrompt } = await this.optimizeStructured(
      prompt,
      model,
      cancellationToken,
    );
    return enhancedPrompt;
  }

  async optimizeStructured(
    prompt: string,
    model: vscode.LanguageModelChat,
    cancellationToken?: vscode.CancellationToken,
  ): Promise<{ enhancedPrompt: string; intent: "ask" | "edit" }> {
    const systemPrompt = this.buildSystemPrompt();

    this.outputChannel.appendLine("Starting structured prompt optimization...");
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
      
      // Clean up markdown code blocks if present (common with LLMs even when asked for pure JSON)
      result = result.replace(/^```json\n/, "").replace(/\n```$/, "").replace(/^```\n/, "");

      this.outputChannel.appendLine(
        `AI Response length: ${result.length} characters`,
      );

      let parsed: { enhancedPrompt: string; intent: "ask" | "edit" };
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        // Fallback if JSON parsing fails
        this.outputChannel.appendLine("Failed to parse JSON response. Fallback to text.");
        return {
          enhancedPrompt: result,
          intent: "ask", // Default to ask
        };
      }

      this.outputChannel.appendLine(`Optimization completed. Intent: ${parsed.intent}`);
      return parsed;

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
    return `You are a prompt expert. Your task is to rewrite the user's raw prompt and determine their intent.

Return a JSON object with this exact structure:
{
  "intent": "ask" | "edit",
  "enhancedPrompt": "..."
}

Rules for Intent:
- "edit": Use this if the user wants to write code, modify files, fix bugs, or generate new files.
- "ask": Use this for questions, explanations, concepts, or general help that doesn't strictly require code modification.

Rules for Enhanced Prompt:
Follow this structure string for the "enhancedPrompt" value:
**Task**
[Clear objective]

**Context**
[Technical context]

**Requirements**
[Bullet points]

**Output**
[Expected output format]

IMPORTANT:
- Output valid JSON only.
- Do NOT use markdown code blocks (\`\`\`).
- Escape newlines in the JSON string properly.`;
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
