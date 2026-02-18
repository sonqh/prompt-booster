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

      // Determine range (selection or full document)
      let range: vscode.Range | undefined;
      const editor = vscode.window.activeTextEditor;

      if (
        editor &&
        editor.document.uri.toString() === document.uri.toString()
      ) {
        if (!editor.selection.isEmpty) {
          range = editor.selection;
        }
      }

      if (!range) {
        // Fallback to full document range if no selection
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        range = new vscode.Range(firstLine.range.start, lastLine.range.end);
      }

      const prompt = document.getText(range);

      this.logger.log(`Boosting document: ${document.uri.toString()}`);

      // Execute strategy with full context
      await this.manualModeStrategy.execute({
        prompt,
        documentUri: document.uri.toString(),
        range: {
          start: {
            line: range.start.line,
            character: range.start.character,
          },
          end: {
            line: range.end.line,
            character: range.end.character,
          },
        },
      });
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
