/**
 * Process File Command - Processes .prompt.md files using File Mode Strategy
 */
import * as vscode from "vscode";
import { FileModeStrategy } from "../../core/strategies/FileModeStrategy";
import { ILogger } from "../../shared/interfaces/ILogger";

export class ProcessFileCommand {
  constructor(
    private fileModeStrategy: FileModeStrategy,
    private logger: ILogger,
  ) {}

  async execute(document?: vscode.TextDocument): Promise<void> {
    this.logger.log("ProcessFileCommand: execute");

    try {
      const doc = document || vscode.window.activeTextEditor?.document;

      if (!doc) {
        vscode.window.showWarningMessage("No prompt file open");
        return;
      }

      if (!doc.fileName.endsWith(".prompt.md")) {
        vscode.window.showWarningMessage(
          "This command only works with .prompt.md files",
        );
        return;
      }

      const content = doc.getText();
      const fileName = doc.fileName;

      await this.fileModeStrategy.processPromptFile(content, fileName);
    } catch (error) {
      this.logger.error("ProcessFileCommand failed", error as Error);
      vscode.window.showErrorMessage(
        `Process file failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  register(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "promptBooster.processPromptFile",
      (document?: vscode.TextDocument) => this.execute(document),
    );
    context.subscriptions.push(disposable);
  }
}
