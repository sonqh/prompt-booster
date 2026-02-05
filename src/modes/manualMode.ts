/**
 * Manual mode implementation - Mode 1
 * Allows users to manually boost .prompt.md files
 */

import * as vscode from "vscode";
import { PromptOptimizer } from "../promptBooster";
import { LanguageModelSelector } from "../models/languageModels";

export class ManualMode {
  constructor(
    private optimizer: PromptOptimizer,
    private modelSelector: LanguageModelSelector,
    private outputChannel: vscode.OutputChannel,
  ) {}

  async boost(uri?: vscode.Uri): Promise<void> {
    try {
      // Get the active editor or use the provided URI
      const editor = vscode.window.activeTextEditor;
      let document: vscode.TextDocument;

      if (uri) {
        document = await vscode.workspace.openTextDocument(uri);
      } else if (editor) {
        document = editor.document;
      } else {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      // Validate it's a .prompt.md file
      if (!document.fileName.endsWith(".prompt.md")) {
        vscode.window.showWarningMessage(
          "PromptBooster only works with .prompt.md files",
        );
        return;
      }

      // Get text to optimize (selection or full document)
      let textToOptimize: string;
      let range: vscode.Range;

      if (editor && !editor.selection.isEmpty) {
        textToOptimize = editor.document.getText(editor.selection);
        range = editor.selection;
      } else {
        textToOptimize = document.getText();
        range = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length),
        );
      }

      if (textToOptimize.trim().length === 0) {
        vscode.window.showWarningMessage("No text to optimize");
        return;
      }

      this.outputChannel.appendLine("=== Manual Boost Started ===");
      this.outputChannel.appendLine(`File: ${document.fileName}`);
      this.outputChannel.appendLine(
        `Text length: ${textToOptimize.length} characters`,
      );

      // Select model - show picker first time, then remember choice
      const model = await this.modelSelector.selectModel();
      if (!model) {
        this.outputChannel.appendLine("Model selection cancelled");
        return;
      }

      // Optimize with progress indicator
      const optimized = await this.optimizer.optimizeWithProgress(
        textToOptimize,
        model,
        "PromptBooster: Optimizing...",
      );

      if (!optimized) {
        // User cancelled
        return;
      }

      // Replace text in editor
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, range, optimized);

      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        vscode.window.showInformationMessage(
          "✓ Prompt optimized successfully!",
        );
        this.outputChannel.appendLine("Optimization applied to document");

        // Show diff if it was the full document
        if (
          range.start.line === 0 &&
          range.end.line === document.lineCount - 1
        ) {
          this.outputChannel.appendLine(
            `Original length: ${textToOptimize.length} chars`,
          );
          this.outputChannel.appendLine(
            `Optimized length: ${optimized.length} chars`,
          );
          this.outputChannel.appendLine(
            `Difference: ${optimized.length - textToOptimize.length} chars`,
          );
        }
      } else {
        vscode.window.showErrorMessage("Failed to apply optimization");
      }

      this.outputChannel.appendLine("=== Manual Boost Completed ===\n");
    } catch (error) {
      this.outputChannel.appendLine(`Error: ${error}`);
      vscode.window.showErrorMessage(
        `Failed to optimize prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
