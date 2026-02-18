import { SYSTEM_PROMPTS } from "../prompts/SystemPrompts";
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
    const systemPrompt = SYSTEM_PROMPTS.OPTIMIZATION;

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
      this.logger.log(`AI Response length: ${result.length} characters`);

      return this.parseResponse(result);
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

  private parseResponse(response: string): PromptResult {
    // 1. Try direct parsing
    try {
      return JSON.parse(response);
    } catch (e) {
      // 2. Try cleaning up markdown code blocks
      const clean = response
        .replace(/^```json\s*/, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");

      try {
        return JSON.parse(clean);
      } catch (e2) {
        // 3. Fallback: Try to extract JSON object from text
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return JSON.parse(match[0]);
          } catch (e3) {
            // Failed to extract valid JSON
          }
        }

        this.logger.warn("Failed to parse JSON response. Fallback to text.");
        return {
          enhancedPrompt: response,
          intent: "ask", // Default to ask
        };
      }
    }
  }

  getSystemPrompt(): string {
    return SYSTEM_PROMPTS.OPTIMIZATION;
  }
}
