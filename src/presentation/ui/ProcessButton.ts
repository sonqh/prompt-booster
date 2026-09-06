/**
 * Process button and CodeLens for file mode
 */

import * as vscode from "vscode";
import { extractFeedbackId } from "../../core/services/PromptFeedbackLog";

export class ProcessButton {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99,
    );
    this.statusBarItem.text = "$(play) Process Prompt";
    this.statusBarItem.command = "promptBooster.processPromptFile";
    this.statusBarItem.tooltip = "Process this prompt file with Copilot";

    // Show only for .prompt.md files in file mode
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      this.updateVisibility(editor);
    });

    this.updateVisibility(vscode.window.activeTextEditor);
  }

  private updateVisibility(editor: vscode.TextEditor | undefined) {
    const config = vscode.workspace.getConfiguration("promptBooster");
    const mode = config.get<string>("operationMode");

    if (
      editor &&
      editor.document.fileName.endsWith(".prompt.md") &&
      mode === "file"
    ) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}

export class PromptFileCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!document.fileName.endsWith(".prompt.md")) {
      return [];
    }

    const topOfDocument = new vscode.Range(0, 0, 0, 0);
    const lenses: vscode.CodeLens[] = [];

    const config = vscode.workspace.getConfiguration("promptBooster");
    const mode = config.get<string>("operationMode");

    // Existing "Process" lens — file mode only (unchanged gate)
    if (mode === "file") {
      lenses.push(
        new vscode.CodeLens(topOfDocument, {
          title: "▶️ Process this prompt with Copilot",
          command: "promptBooster.processPromptFile",
          tooltip: "Send this prompt to GitHub Copilot",
          arguments: [document],
        }),
      );
    }

    // "Use This Version" lens (Phase E1): shown for ANY .prompt.md whose
    // leading comment carries a PromptBooster-Feedback-Id header — regardless
    // of operation mode, because refine-in-file starts from chat/realtime
    // mode. Finalizes the edit-path feedback record, then sends the edited
    // text to chat.
    if (extractFeedbackId(document.getText()) !== undefined) {
      lenses.push(
        new vscode.CodeLens(topOfDocument, {
          title: "✓ Use This Version",
          command: "promptBooster.usePromptVersion",
          tooltip:
            "Record this version as the final prompt and send it to GitHub Copilot",
          arguments: [document],
        }),
      );
    }

    return lenses;
  }
}
