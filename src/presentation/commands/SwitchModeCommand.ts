/**
 * Switch Mode Command - Allows user to switch between operation modes
 */
import * as vscode from "vscode";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { OperationMode } from "../../shared/types/OperationMode";
import { ILogger } from "../../shared/interfaces/ILogger";

export class SwitchModeCommand {
  constructor(
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {}

  async execute(): Promise<void> {
    this.logger.log("SwitchModeCommand: execute");

    const modes: { label: string; mode: OperationMode; description: string }[] =
      [
        {
          label: "$(wand) Manual Mode",
          mode: "manual",
          description: "Boost prompts via right-click menu or toolbar button",
        },
        {
          label: "$(rocket) Real-time Mode",
          mode: "realtime",
          description: "Instantly intercept and optimize chat prompts",
        },
        {
          label: "$(new-file) File Mode",
          mode: "file",
          description: "Generate editable prompt files for maximum control",
        },
      ];

    const selected = await vscode.window.showQuickPick(modes, {
      placeHolder: "Select operation mode",
    });

    if (selected) {
      await this.configManager.setOperationMode(selected.mode);
      vscode.window.showInformationMessage(
        `PromptBooster switched to ${selected.label}`,
      );
      this.logger.log(`Mode switched to: ${selected.mode}`);
    }
  }

  register(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "promptBooster.switchMode",
      () => this.execute(),
    );
    context.subscriptions.push(disposable);
  }
}
