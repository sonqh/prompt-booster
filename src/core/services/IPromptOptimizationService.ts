/**
 * Prompt Optimization Service Interface
 */
import {
  PromptResult,
  OptimizationOptions,
} from "../../shared/types/PromptResult";

export interface IPromptOptimizationService {
  /**
   * Optimize a prompt and return just the enhanced version
   */
  optimize(prompt: string, options: OptimizationOptions): Promise<string>;

  /**
   * Optimize a prompt and return structured result with intent
   */
  optimizeStructured(
    prompt: string,
    options: OptimizationOptions,
  ): Promise<PromptResult>;

  /**
   * Get the system prompt used for optimization
   */
  getSystemPrompt(): string;
}
