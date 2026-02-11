/**
 * Prompt Optimization Service - Core business logic
 * Refactored from promptBooster.ts with dependency injection
 */
import { IPromptOptimizationService } from "./IPromptOptimizationService";
import {
  PromptResult,
  OptimizationOptions,
} from "../../shared/types/PromptResult";
import { ILogger } from "../../shared/interfaces/ILogger";
import * as vscode from "vscode";

export class PromptOptimizationService implements IPromptOptimizationService {
  constructor(private logger: ILogger) {}

  async optimize(
    prompt: string,
    options: OptimizationOptions,
  ): Promise<string> {
    const { enhancedPrompt } = await this.optimizeStructured(prompt, options);
    return enhancedPrompt;
  }

  async optimizeStructured(
    prompt: string,
    options: OptimizationOptions,
  ): Promise<PromptResult> {
    const systemPrompt = this.getSystemPrompt();

    this.logger.log("Starting structured prompt optimization...");
    this.logger.log(`Original prompt length: ${prompt.length} characters`);

    try {
      const messages = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(prompt),
      ];

      const request = await options.model.sendRequest(
        messages,
        {},
        options.cancellationToken,
      );

      let result = "";
      for await (const chunk of request.text) {
        result += chunk;
      }

      result = result.trim();

      // Clean up markdown code blocks if present (common with LLMs even when asked for pure JSON)
      result = result
        .replace(/^```json\n/, "")
        .replace(/\n```$/, "")
        .replace(/^```\n/, "");

      this.logger.log(`AI Response length: ${result.length} characters`);

      let parsed: PromptResult;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        // Fallback if JSON parsing fails
        this.logger.warn("Failed to parse JSON response. Fallback to text.");
        return {
          enhancedPrompt: result,
          intent: "ask", // Default to ask
        };
      }

      this.logger.log(`Optimization completed. Intent: ${parsed.intent}`);
      return parsed;
    } catch (error) {
      this.logger.error("Optimization error", error as Error);

      if (error instanceof vscode.CancellationError) {
        throw new Error("Optimization cancelled by user");
      }

      throw new Error(
        `Failed to optimize prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getSystemPrompt(): string {
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
}
