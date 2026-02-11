/**
 * Boost Command - Executes Manual Mode Strategy
 */
import * as vscode from "vscode";
import { IModeStrategy } from "../../core/strategies/IModeStrategy";
import { ILogger } from "../../shared/interfaces/ILogger";

export class BoostCommand {
  constructor(
    private manualModeStrategy: IModeStrategy,
    private logger: ILogger,
  ) {}

  async execute(uri?: vscode.Uri): Promise<void> {
    this.logger.log("BoostCommand: execute");

    try {
      // Get the document from URI or active editor
      const document = uri
        ? await vscode.workspace.openTextDocument(uri)
        : vscode.window.activeTextEditor?.document;

      if (!document) {
        vscode.window.showWarningMessage("No document to boost");
        return;
      }

      // Get selected text or full document
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.selection;
      const prompt =
        selection && !selection.isEmpty
          ? document.getText(selection)
          : document.getText();

      // Execute strategy
      await this.manualModeStrategy.execute({ prompt });
    } catch (error) {
      this.logger.error("BoostCommand failed", error as Error);
      vscode.window.showErrorMessage(
        `Boost failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  register(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "promptBooster.boost",
      (uri?: vscode.Uri) => this.execute(uri),
    );
    context.subscriptions.push(disposable);
  }
}
