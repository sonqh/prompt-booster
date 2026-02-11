/**
 * Realtime Mode Strategy
 * Intercepts chat prompts and shows preview with interactive buttons
 */
import * as vscode from "vscode";
import { IModeStrategy } from "./IModeStrategy";
import { IPromptOptimizationService } from "../services/IPromptOptimizationService";
import { ILanguageModelProvider } from "../models/ILanguageModelProvider";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";
import { ModeExecutionContext } from "../../shared/types/PromptResult";
import { OperationMode } from "../../shared/types/OperationMode";

export class RealtimeModeStrategy implements IModeStrategy {
  private readonly timeoutMs = 20000; // 20 second timeout

  constructor(
    private optimizer: IPromptOptimizationService,
    private modelProvider: ILanguageModelProvider,
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {}

  canHandle(mode: OperationMode): boolean {
    return mode === "realtime";
  }

  async execute(context: ModeExecutionContext): Promise<void> {
    const stream = context.metadata?.stream as vscode.ChatResponseStream;
    const request = context.metadata?.request as vscode.ChatRequest;
    const token = context.metadata?.token as vscode.CancellationToken;

    if (!stream || !request || !token) {
      this.logger.error("Missing chat context metadata");
      return;
    }

    this.logger.log(`Executing Realtime Mode Strategy: ${request.prompt}`);

    // Check if auto-optimize is enabled
    if (!this.configManager.isAutoOptimizeEnabled()) {
      this.logger.log("Auto-optimize disabled - passing through");
      stream.markdown(
        "⚠️ Auto-optimization is disabled. Run **PromptBooster: Toggle Auto-Optimization** to enable.",
      );
      return;
    }

    // Check permissions
    const hasPermission = await this.configManager.hasPermission();
    if (!hasPermission) {
      this.logger.log("Permission denied");
      stream.markdown(
        "⚠️ Permission required to optimize prompts. Run **PromptBooster: Configure Permissions** to grant access.",
      );
      return;
    }

    // Get model
    const model = await this.modelProvider.getModelAutomatically();
    if (!model) {
      this.logger.log("No language model available");
      stream.markdown(
        "⚠️ No language model available. Please ensure GitHub Copilot is active.",
      );
      return;
    }

    this.logger.log(`Using model: ${model.name}`);

    // Build prompt with context
    const promptWithContext = this.buildPromptWithContext(
      request.prompt,
      request,
    );

    // Optimize with timeout
    try {
      stream.progress("Optimizing your prompt...");

      const result = await Promise.race([
        this.optimizer.optimizeStructured(promptWithContext, {
          model,
          cancellationToken: token,
        }),
        this.createTimeout(this.timeoutMs) as any,
      ]);

      if (token.isCancellationRequested) {
        stream.markdown("⚠️ Optimization cancelled.");
        return;
      }

      if (result) {
        this.renderInteractiveResponse(
          request.prompt,
          result.enhancedPrompt,
          result.intent,
          stream,
        );
      }
    } catch (error) {
      this.logger.error("Optimization failed", error as Error);
      stream.markdown(
        "⚠️ Optimization timed out or failed. Falling back to original prompt.\n\n",
      );
    }
  }

  private renderInteractiveResponse(
    original: string,
    optimized: string,
    intent: "ask" | "edit",
    stream: vscode.ChatResponseStream,
  ) {
    stream.markdown(`**Optimized Prompt**\n\n`);
    stream.markdown(`> ${optimized.replace(/\n/g, "\n> ")}\n\n`);

    if (intent === "edit") {
      stream.button({
        command: "promptBooster.runPrompt",
        title: "$(sparkle) Apply Edits",
        tooltip: "Run this prompt to apply edits",
        arguments: [optimized],
      });
      stream.button({
        command: "promptBooster.createPromptFile",
        title: "$(edit) Refine in File",
        tooltip: "Open in editor for manual refinement",
        arguments: [original, optimized],
      });
    } else {
      stream.button({
        command: "promptBooster.runPrompt",
        title: "$(comment-discussion) Ask Copilot",
        tooltip: "Send enhanced prompt to Copilot",
        arguments: [optimized],
      });
      stream.button({
        command: "promptBooster.createPromptFile",
        title: "$(edit) Edit",
        tooltip: "Edit prompt before sending",
        arguments: [original, optimized],
      });
    }

    stream.button({
      command: "promptBooster.runPrompt",
      title: "$(reply) Use Original",
      tooltip: "Revert to original prompt",
      arguments: [original],
    });
  }

  private buildPromptWithContext(
    prompt: string,
    request: vscode.ChatRequest,
  ): string {
    let enhancedPrompt = prompt;

    if (request.references && request.references.length > 0) {
      const referenceContext = request.references
        .map((ref) => {
          if (ref.value instanceof vscode.Uri) {
            return `File: ${ref.value.fsPath}`;
          } else if (ref.value instanceof vscode.Location) {
            return `Location: ${ref.value.uri.fsPath}:${ref.value.range.start.line}`;
          } else if (typeof ref.value === "string") {
            return `Context: ${ref.value}`;
          }
          // Note: Handling rich object references might require more complex logic
          // simplified here for brevity
          return "";
        })
        .filter((s) => s)
        .join("\n\n");

      if (referenceContext) {
        enhancedPrompt = `${referenceContext}\n\nUser Request:\n${prompt}`;
      }
    }

    return enhancedPrompt;
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Optimization timed out after ${ms}ms`));
      }, ms);
    });
  }
}
