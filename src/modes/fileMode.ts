/**
 * File mode implementation - Mode 3
 * Generates .prompt.md files for editing
 */

import * as vscode from "vscode";
import * as path from "path";

export class FileMode {
  constructor(private outputChannel: vscode.OutputChannel) {}

  async generatePromptFile(
    original: string,
    optimized: string,
  ): Promise<string | undefined> {
    try {
      const config = vscode.workspace.getConfiguration("promptBooster");
      const outputDir = config.get<string>(
        "fileOutputDirectory",
        ".github/prompts",
      );
      const namingPattern = config.get<string>("fileNamingPattern", "prompt");

      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace folder open");
      }

      // Ensure output directory exists
      const fullOutputPath = path.join(workspaceFolder.uri.fsPath, outputDir);
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(fullOutputPath),
      );

      // Generate filename
      const filename = await this.generateFilename(original, namingPattern);
      if (!filename) {
        return undefined; // User cancelled
      }

      const filePath = path.join(fullOutputPath, filename);

      // Create file content
      const content = this.buildFileContent(original, optimized);

      // Write file
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(filePath),
        Buffer.from(content, "utf8"),
      );

      this.outputChannel.appendLine(
        `File mode: Generated prompt file at ${filePath}`,
      );
      return filePath;
    } catch (error) {
      this.outputChannel.appendLine(`Error generating file: ${error}`);
      throw error;
    }
  }

  private async generateFilename(
    original: string,
    pattern: string,
  ): Promise<string | undefined> {
    switch (pattern) {
      case "timestamp": {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        return `chat-${timestamp}.prompt.md`;
      }

      case "prompt": {
        // Extract first line, convert to slug
        const firstLine = original.split("\n")[0].trim();
        const slug = firstLine
          .substring(0, 50)
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-");

        // Handle collisions
        return await this.resolveCollision(`${slug}.prompt.md`);
      }

      case "custom": {
        const userFilename = await vscode.window.showInputBox({
          prompt: "Enter a name for this prompt file",
          value: "my-prompt",
          validateInput: (value) => {
            if (!value.trim()) {
              return "Filename cannot be empty";
            }
            if (!/^[a-zA-Z0-9\-_]+$/.test(value)) {
              return "Use only letters, numbers, hyphens, and underscores";
            }
            return null;
          },
        });

        if (!userFilename) {
          return undefined; // User cancelled
        }
        return `${userFilename}.prompt.md`;
      }

      default:
        return `prompt-${Date.now()}.prompt.md`;
    }
  }

  private async resolveCollision(
    filename: string,
  ): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration("promptBooster");
    const outputDir = config.get<string>(
      "fileOutputDirectory",
      ".github/prompts",
    );
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return filename;
    }

    const fullPath = path.join(workspaceFolder.uri.fsPath, outputDir);
    let counter = 2;
    let finalFilename = filename;
    let fileExists = true;

    while (fileExists) {
      try {
        const testPath = path.join(fullPath, finalFilename);
        await vscode.workspace.fs.stat(vscode.Uri.file(testPath));
        // File exists, try next number
        const base = filename.replace(".prompt.md", "");
        finalFilename = `${base}-${counter}.prompt.md`;
        counter++;
      } catch {
        // File doesn't exist, use this name
        fileExists = false;
      }
    }

    return finalFilename;
  }

  private buildFileContent(original: string, optimized: string): string {
    const timestamp = new Date().toISOString();
    return `<!--
Original Prompt:
${original}

Generated: ${timestamp}
Mode: File Generation
-->

${optimized}

<!--
Instructions:
1. Edit this prompt as needed
2. Click the "Process" button in the editor title bar, or
3. Use Command Palette: "PromptBooster: Process Prompt File"
4. The optimized prompt will be sent to GitHub Copilot
-->
`;
  }

  async processPromptFile(document: vscode.TextDocument): Promise<void> {
    try {
      this.outputChannel.appendLine("=== Processing Prompt File ===");
      this.outputChannel.appendLine(`File: ${document.fileName}`);

      // Read and clean content
      let content = document.getText();

      // Remove HTML comments
      content = content.replace(/<!--[\s\S]*?-->/g, "").trim();

      if (!content) {
        vscode.window.showWarningMessage(
          "Prompt file is empty after removing comments",
        );
        return;
      }

      this.outputChannel.appendLine(
        `Cleaned content length: ${content.length} characters`,
      );

      // TODO: Send to Copilot chat (requires chat participant implementation)
      // For now, just show the content
      vscode.window.showInformationMessage(
        `Prompt ready to process (${content.length} chars). Chat integration coming soon!`,
      );

      // Show in output channel
      this.outputChannel.appendLine("=== Prompt Content ===");
      this.outputChannel.appendLine(content);
      this.outputChannel.show();
    } catch (error) {
      this.outputChannel.appendLine(`Error processing file: ${error}`);
      vscode.window.showErrorMessage(
        `Failed to process prompt file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
