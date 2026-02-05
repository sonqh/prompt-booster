/**
 * Language model selection and management
 */

import * as vscode from "vscode";

export class LanguageModelSelector {
  private outputChannel: vscode.OutputChannel;
  private lastUsedModel: vscode.LanguageModelChat | undefined;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  async selectModel(
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

      this.outputChannel.appendLine(
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
        this.outputChannel.appendLine(
          `Using last selected model: ${this.lastUsedModel.id}`,
        );
        this.warnIfSlowModel(this.lastUsedModel);
        return this.lastUsedModel;
      }

      // Last used model not available, show picker
      this.outputChannel.appendLine("Last used model no longer available");
      const selectedModel = await this.showModelPicker(models);
      if (selectedModel) {
        this.warnIfSlowModel(selectedModel);
        this.lastUsedModel = selectedModel;
      }
      return selectedModel;
    } catch (error) {
      this.outputChannel.appendLine(`Error selecting model: ${error}`);
      vscode.window.showErrorMessage(
        `Failed to select language model: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private async showModelPicker(
    models: vscode.LanguageModelChat[],
  ): Promise<vscode.LanguageModelChat | undefined> {
    const preference = vscode.workspace
      .getConfiguration("promptBooster")
      .get("modelPreference", "gpt-4.1");

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
      this.outputChannel.appendLine(
        `User selected model: ${selected.model.id}`,
      );
      return selected.model;
    }

    return undefined;
  }

  /**
   * Get a model automatically without user interaction
   * Uses last used model, then preferred, then first available
   */
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
          this.outputChannel.appendLine(
            `Using last selected model: ${this.lastUsedModel.id}`,
          );
          this.warnIfSlowModel(this.lastUsedModel);
          return this.lastUsedModel;
        }
      }

      // 2. Try preferred model from settings
      const preference = vscode.workspace
        .getConfiguration("promptBooster")
        .get("modelPreference", "gpt-4.1");

      const preferredModel = models.find((m) => {
        const modelName = m.id.toLowerCase();
        return modelName.includes(preference.toLowerCase().replace("-", ""));
      });

      if (preferredModel) {
        this.outputChannel.appendLine(
          `Using preferred model from settings: ${preferredModel.id}`,
        );
        this.warnIfSlowModel(preferredModel);
        this.lastUsedModel = preferredModel;
        return preferredModel;
      }

      // 3. Fallback to first available model
      this.outputChannel.appendLine(
        `Using first available model: ${models[0].id}`,
      );
      this.warnIfSlowModel(models[0]);
      this.lastUsedModel = models[0];
      return models[0];
    } catch (error) {
      this.outputChannel.appendLine(`Error getting model: ${error}`);
      return undefined;
    }
  }

  async testModelAvailability(): Promise<boolean> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      return models.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Reset the last used model (for testing)
   */
  resetLastUsedModel(): void {
    this.lastUsedModel = undefined;
  }

  /**
   * Warn if the model is known to be slow (GPT-5 mini)
   */
  private warnIfSlowModel(model: vscode.LanguageModelChat): void {
    const modelId = model.id.toLowerCase();
    if (modelId.includes("gpt-5") && modelId.includes("mini")) {
      this.outputChannel.appendLine(
        "⚠️  WARNING: GPT-5 mini is selected. This model may have slow response times.",
      );
      this.outputChannel.appendLine(
        "⚠️  Optimization may take longer or timeout. Consider using a faster model.",
      );
    }
  }
}
