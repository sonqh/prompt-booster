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
          label: "Manual Mode",
          mode: "manual",
          description: "Boost prompts via right-click menu on .prompt.md files",
        },
        {
          label: "Realtime Mode",
          mode: "realtime",
          description: "Automatically optimize prompts in chat",
        },
        {
          label: "File Mode",
          mode: "file",
          description: "Generate .prompt.md files from prompts",
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
