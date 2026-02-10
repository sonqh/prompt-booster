/**
 * Manual Mode Strategy
 * Handles "Boost This Prompt" command
 */
import * as vscode from "vscode";
import { IModeStrategy } from "./IModeStrategy";
import { IPromptOptimizationService } from "../services/IPromptOptimizationService";
import { ILanguageModelProvider } from "../models/ILanguageModelProvider";
import { ILogger } from "../../shared/interfaces/ILogger";
import { IProgressService } from "../../shared/interfaces/IProgressReporter";
import { ModeExecutionContext } from "../../shared/types/PromptResult";
import { OperationMode } from "../../shared/types/OperationMode";

export class ManualModeStrategy implements IModeStrategy {
  constructor(
    private optimizer: IPromptOptimizationService,
    private modelProvider: ILanguageModelProvider,
    private progressService: IProgressService,
    private logger: ILogger,
  ) {}

  canHandle(mode: OperationMode): boolean {
    return mode === "manual";
  }

  async execute(context: ModeExecutionContext): Promise<void> {
    this.logger.log("Executing Manual Mode Strategy");

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
        title: "PromptBooster: Optimizing...",
        cancellable: true,
      },
      async (reporter, token) => {
        reporter.report("Sending to AI model...");
        return await this.optimizer.optimize(textToOptimize, {
          model,
          cancellationToken: token,
        });
      },
    );

    if (!optimized) {
      return;
    }

    // Apply changes
    await this.applyChanges(context, optimized, textToOptimize.length);
  }

  private async applyChanges(
    context: ModeExecutionContext,
    newText: string,
    originalLength: number,
  ): Promise<void> {
    if (!context.documentUri) {
      this.logger.error("No document URI provided for manual mode");
      return;
    }

    const uri = vscode.Uri.parse(context.documentUri);
    const edit = new vscode.WorkspaceEdit();

    if (context.range) {
      const range = new vscode.Range(
        context.range.start.line,
        context.range.start.character,
        context.range.end.line,
        context.range.end.character,
      );
      edit.replace(uri, range, newText);
    } else {
      // Should replace full document?
      // For now assuming if no range, we might need to find the range or it's full doc.
      // But typically context.range should be populated by the Command.
      // If not, we might fail or try to read doc.
      // Let's assume Command does its job.
      this.logger.error("No range provided for replacement");
      return;
    }

    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      vscode.window.showInformationMessage("✓ Prompt optimized successfully!");

      this.logger.log(`Original length: ${originalLength} chars`);
      this.logger.log(`Optimized length: ${newText.length} chars`);
    } else {
      vscode.window.showErrorMessage("Failed to apply optimization");
    }
  }
}
