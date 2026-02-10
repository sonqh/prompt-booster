/**
 * VS Code Language Model Provider
 * Implements ILanguageModelProvider to manage AI models
 */
import * as vscode from "vscode";
import { ILanguageModelProvider } from "../../core/models/ILanguageModelProvider";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";

export class LanguageModelProvider implements ILanguageModelProvider {
  private lastUsedModel: vscode.LanguageModelChat | undefined;

  constructor(
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {}

  async getModel(
    forcePrompt = false,
  ): Promise<vscode.LanguageModelChat | undefined> {
    try {
      // Get all available models
      const models = await vscode.lm.selectChatModels({
        vendor: "copilot",
      });

      if (models.length === 0) {
        throw new Error(
          "No language models available. Please ensure GitHub Copilot is installed and active.",
        );
      }

      this.logger.log(
        `Found ${models.length} available model(s): ${models.map((m) => m.id).join(", ")}`,
      );

      // If user wants to choose or there's no last used model, show picker
      if (forcePrompt || !this.lastUsedModel) {
        const selectedModel = await this.showModelPicker(models);
        if (selectedModel) {
          this.warnIfSlowModel(selectedModel);
          this.lastUsedModel = selectedModel;
        }
        return selectedModel;
      }

      // Return the last used model if it's still available
      const isLastUsedAvailable = models.some(
        (m) => m.id === this.lastUsedModel?.id,
      );
      if (isLastUsedAvailable) {
        this.logger.log(`Using last selected model: ${this.lastUsedModel.id}`);
        this.warnIfSlowModel(this.lastUsedModel);
        return this.lastUsedModel;
      }

      // Last used model not available, show picker
      this.logger.log("Last used model no longer available");
      const selectedModel = await this.showModelPicker(models);
      if (selectedModel) {
        this.warnIfSlowModel(selectedModel);
        this.lastUsedModel = selectedModel;
      }
      return selectedModel;
    } catch (error) {
      this.logger.error("Error selecting model", error as Error);
      vscode.window.showErrorMessage(
        `Failed to select language model: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  async getModelAutomatically(): Promise<vscode.LanguageModelChat | undefined> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: "copilot",
      });

      if (models.length === 0) {
        throw new Error("No language models available");
      }

      // 1. Try last used model
      if (this.lastUsedModel) {
        const isAvailable = models.some((m) => m.id === this.lastUsedModel?.id);
        if (isAvailable) {
          this.logger.log(
            `Using last selected model: ${this.lastUsedModel.id}`,
          );
          this.warnIfSlowModel(this.lastUsedModel);
          return this.lastUsedModel;
        }
      }

      // 2. Try preferred model from settings
      const preference = this.configManager.getModelPreference();

      const preferredModel = models.find((m) => {
        const modelName = m.id.toLowerCase();
        return modelName.includes(preference.toLowerCase().replace("-", ""));
      });

      if (preferredModel) {
        this.logger.log(
          `Using preferred model from settings: ${preferredModel.id}`,
        );
        this.warnIfSlowModel(preferredModel);
        this.lastUsedModel = preferredModel;
        return preferredModel;
      }

      // 3. Fallback to first available model
      this.logger.log(`Using first available model: ${models[0].id}`);
      this.warnIfSlowModel(models[0]);
      this.lastUsedModel = models[0];
      return models[0];
    } catch (error) {
      this.logger.error("Error getting model", error as Error);
      return undefined;
    }
  }

  async hasModels(): Promise<boolean> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      return models.length > 0;
    } catch {
      return false;
    }
  }

  resetLastUsedModel(): void {
    this.lastUsedModel = undefined;
  }

  private async showModelPicker(
    models: vscode.LanguageModelChat[],
  ): Promise<vscode.LanguageModelChat | undefined> {
    const preference = this.configManager.getModelPreference();

    // Create picker items
    const items = models.map((model) => {
      const isPreferred = model.id
        .toLowerCase()
        .includes(preference.toLowerCase().replace("-", ""));
      const isLastUsed =
        this.lastUsedModel && model.id === this.lastUsedModel.id;

      const description = `${model.vendor}`;
      const details: string[] = [];

      if (isLastUsed) {
        details.push("$(check) Last used");
      }
      if (isPreferred) {
        details.push("$(star) Preferred");
      }

      return {
        label: `$(hubot) ${model.name || model.id}`,
        description,
        detail: details.length > 0 ? details.join(" • ") : undefined,
        model,
      };
    });

    // Sort: last used first, then preferred, then alphabetically
    items.sort((a, b) => {
      const aIsLastUsed = a.model.id === this.lastUsedModel?.id;
      const bIsLastUsed = b.model.id === this.lastUsedModel?.id;
      if (aIsLastUsed && !bIsLastUsed) {
        return -1;
      }
      if (!aIsLastUsed && bIsLastUsed) {
        return 1;
      }

      const aIsPreferred = a.detail?.includes("Preferred");
      const bIsPreferred = b.detail?.includes("Preferred");
      if (aIsPreferred && !bIsPreferred) {
        return -1;
      }
      if (!aIsPreferred && bIsPreferred) {
        return 1;
      }

      return a.label.localeCompare(b.label);
    });

    const selected = await vscode.window.showQuickPick(items, {
      title: "Select AI Model for Prompt Optimization",
      placeHolder: "Choose which model to use",
      matchOnDescription: true,
    });

    if (selected) {
      this.logger.log(`User selected model: ${selected.model.id}`);
      return selected.model;
    }

    return undefined;
  }

  private warnIfSlowModel(model: vscode.LanguageModelChat): void {
    const modelId = model.id.toLowerCase();
    if (modelId.includes("gpt-5") && modelId.includes("mini")) {
      this.logger.warn(
        "GPT-5 mini is selected. This model may have slow response times.",
      );
      this.logger.warn(
        "Optimization may take longer or timeout. Consider using a faster model.",
      );
    }
  }
}
