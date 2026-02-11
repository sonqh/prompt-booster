/**
 * Process button and CodeLens for file mode
 */

import * as vscode from "vscode";

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
    const config = vscode.workspace.getConfiguration("promptBooster");
    const mode = config.get<string>("operationMode");

    // Only show in file mode
    if (mode !== "file" || !document.fileName.endsWith(".prompt.md")) {
      return [];
    }

    // Add CodeLens at the top of the file
    const topOfDocument = new vscode.Range(0, 0, 0, 0);
    const codeLens = new vscode.CodeLens(topOfDocument, {
      title: "▶️ Process this prompt with Copilot",
      command: "promptBooster.processPromptFile",
      tooltip: "Send this prompt to GitHub Copilot",
      arguments: [document],
    });

    return [codeLens];
  }
}
