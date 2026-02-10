/**
 * Language Model Provider Interface
 */
import * as vscode from "vscode";

export interface ILanguageModelProvider {
  /**
   * Get a language model for use
   * @param forcePrompt Force showing the model selection prompt
   */
  getModel(
    forcePrompt?: boolean,
  ): Promise<vscode.LanguageModelChat | undefined>;

  /**
   * Get model automatically without user interaction
   */
  getModelAutomatically(): Promise<vscode.LanguageModelChat | undefined>;

  /**
   * Check if any models are available
   */
  hasModels(): Promise<boolean>;

  /**
   * Reset the last used model cache
   */
  resetLastUsedModel(): void;
}
