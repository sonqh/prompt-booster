/**
 * Switch Model Command - Allows user to switch between AI models
 */
import * as vscode from "vscode";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager.js";
import { ILogger } from "../../shared/interfaces/ILogger.js";

export class SwitchModelCommand {
  constructor(
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {}

  async execute(): Promise<void> {
    this.logger.log("SwitchModelCommand: execute");

    const models = [
      {
        label: "GPT-4.1",
        value: "gpt-4.1",
        description: "Standard GPT-4 model",
      },
      {
        label: "GPT-4o",
        value: "gpt-4o",
        description: "Optimized GPT-4 model",
      },
      {
        label: "Claude Haiku 4.5",
        value: "claude-haiku-4.5",
        description: "Fast and efficient model",
      },
    ];

    const currentModel = this.configManager.getModelPreference();

    // Mark current selection
    const items = models.map((m) => ({
      ...m,
      picked: m.value === currentModel,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select AI Model Preference",
    });

    if (selected) {
      await this.configManager.setModelPreference(selected.value);
      vscode.window.showInformationMessage(
        `PromptBooster model switched to ${selected.label}`,
      );
      this.logger.log(`Model switched to: ${selected.value}`);
    }
  }

  register(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "promptBooster.switchModel",
      () => this.execute(),
    );
    context.subscriptions.push(disposable);
  }
}
