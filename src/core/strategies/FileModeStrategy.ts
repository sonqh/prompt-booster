/**
 * File Mode Strategy
 * Generates .prompt.md files from prompts
 */
import * as vscode from "vscode";
import { IModeStrategy } from "./IModeStrategy";
import { IPromptOptimizationService } from "../services/IPromptOptimizationService";
import { ILanguageModelProvider } from "../models/ILanguageModelProvider";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import { ILogger } from "../../shared/interfaces/ILogger";
import { IProgressService } from "../../shared/interfaces/IProgressReporter";
import { ModeExecutionContext } from "../../shared/types/PromptResult";
import { OperationMode } from "../../shared/types/OperationMode";

export class FileModeStrategy implements IModeStrategy {
  constructor(
    private optimizer: IPromptOptimizationService,
    private modelProvider: ILanguageModelProvider,
    private configManager: IConfigurationManager,
    private fileSystem: IFileSystem,
    private progressService: IProgressService,
    private logger: ILogger,
  ) {}

  canHandle(mode: OperationMode): boolean {
    return mode === "file";
  }

  async execute(context: ModeExecutionContext): Promise<void> {
    this.logger.log("Executing File Mode Strategy");

    const textToOptimize = context.prompt;
    if (!textToOptimize || textToOptimize.trim().length === 0) {
      vscode.window.showWarningMessage("No text to optimize");
      return;
    }

    // Select model
    const model = await this.modelProvider.getModel();
    if (!model) {
      this.logger.log("Model selection cancelled");
      return;
    }

    // Optimize with progress
    const optimized = await this.progressService.withProgress(
      {
        title: "PromptBooster: Generating prompt file...",
        cancellable: true,
      },
      async (reporter, token) => {
        reporter.report("Optimizing prompt...");
        return await this.optimizer.optimize(textToOptimize, {
          model,
          cancellationToken: token,
        });
      },
    );

    if (!optimized) {
      return;
    }

    // Generate file
    const filePath = await this.generatePromptFile(textToOptimize, optimized);

    if (filePath) {
      try {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        this.logger.error("Failed to open generated file", error as Error);
      }
    }
  }

  /**
   * Generate a prompt file with the optimized content
   */
  async generatePromptFile(
    original: string,
    optimized: string,
  ): Promise<string | undefined> {
    try {
      const outputDir = this.configManager.getFileOutputDirectory();
      const namingPattern = this.configManager.getFileNamingPattern();
      const workspacePath = this.fileSystem.getWorkspacePath();

      if (!workspacePath) {
        throw new Error("No workspace folder open");
      }

      // Ensure output directory exists
      const fullOutputPath = this.fileSystem.joinPath(workspacePath, outputDir);
      if (!(await this.fileSystem.fileExists(fullOutputPath))) {
        await this.fileSystem.createDirectory(fullOutputPath);
      }

      // Generate filename
      const filename = await this.generateFilename(original, namingPattern);
      if (!filename) {
        return undefined; // User cancelled
      }

      const filePath = this.fileSystem.joinPath(fullOutputPath, filename);

      // Create file content
      const content = this.buildFileContent(original, optimized);

      // Write file
      await this.fileSystem.writeFile(filePath, content);

      this.logger.log(`Generated prompt file at ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error("Error generating file", error as Error);
      throw error;
    }
  }

  /**
   * Process a prompt file (send to Copilot)
   * Note: This is a public method called by the ProcessFileCommand
   */
  async processPromptFile(content: string, fileName: string): Promise<void> {
    try {
      this.logger.log(`Processing prompt file: ${fileName}`);

      // Remove HTML comments
      const cleanContent = content.replace(/<!--[\s\S]*?-->/g, "").trim();

      if (!cleanContent) {
        vscode.window.showWarningMessage(
          "Prompt file is empty after removing comments",
        );
        return;
      }

      // Execute in Chat
      const success = await vscode.commands.executeCommand(
        "workbench.action.chat.open",
        {
          query: cleanContent,
        },
      );

      if (!success) {
        vscode.window.showInformationMessage(
          `Prompt ready! Copying to clipboard...`,
        );
        await vscode.env.clipboard.writeText(cleanContent);
      }
    } catch (error) {
      this.logger.error("Error processing file", error as Error);
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
        const firstLine = original.split("\n")[0].trim();
        const slug = firstLine
          .substring(0, 50)
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-");

        return await this.resolveCollision(slug);
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
          return undefined;
        }
        return `${userFilename}.prompt.md`;
      }

      default:
        return `prompt-${Date.now()}.prompt.md`;
    }
  }

  private async resolveCollision(baseName: string): Promise<string> {
    const outputDir = this.configManager.getFileOutputDirectory();
    const workspacePath = this.fileSystem.getWorkspacePath();

    // Safety check - if no workspace, just return the name
    if (!workspacePath) return `${baseName}.prompt.md`;

    const fullPath = this.fileSystem.joinPath(workspacePath, outputDir);
    let counter = 1;
    let filename = `${baseName}.prompt.md`;

    // Note: This logic assumes if we counter up we eventually find a spot
    // Using fileSystem.fileExists check
    while (
      await this.fileSystem.fileExists(
        this.fileSystem.joinPath(fullPath, filename),
      )
    ) {
      counter++;
      filename = `${baseName}-${counter}.prompt.md`;
    }

    return filename;
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
}
