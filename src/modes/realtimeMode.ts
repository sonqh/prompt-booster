/**
 * Real-time mode implementation - Mode 2
 * Intercepts chat prompts and shows preview with interactive buttons
 */

import * as vscode from "vscode";
import { PromptOptimizer } from "../promptBooster";
import { LanguageModelSelector } from "../models/languageModels";
import { ModeManager } from "../config/settings";

export class RealtimeMode {
  private readonly timeoutMs = 20000; // 20 second timeout

  constructor(
    private modeManager: ModeManager,
    private optimizer: PromptOptimizer,
    private modelSelector: LanguageModelSelector,
    private outputChannel: vscode.OutputChannel,
  ) {}

  /**
   * Handle chat request - called by VS Code chat participant
   */
  async handleChatRequest(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<void> {
    try {
      // Log request details
      this.outputChannel.appendLine("=== Realtime Chat Request ===");
      this.outputChannel.appendLine(`Prompt: ${request.prompt}`);
      this.outputChannel.appendLine(`Command: ${request.command || "(none)"}`);

      // Check if mode is set to realtime
      if (this.modeManager.getMode() !== "realtime") {
        this.outputChannel.appendLine("Not in realtime mode - passing through");
        stream.markdown(
          `⚠️ PromptBooster is in **${this.modeManager.getMode()}** mode. Switch to **realtime** mode to enable chat optimization.`,
        );
        return;
      }

      // Check if auto-optimize is enabled
      if (!this.modeManager.isAutoOptimizeEnabled()) {
        this.outputChannel.appendLine(
          "Auto-optimize disabled - passing through",
        );
        stream.markdown(
          "⚠️ Auto-optimization is disabled. Enable it to optimize chat prompts.",
        );
        return;
      }

      // Check permissions
      const hasPermission = await this.modeManager.checkPermission();
      if (!hasPermission) {
        this.outputChannel.appendLine("Permission denied");
        stream.markdown(
          "⚠️ Permission required to optimize prompts. Run **PromptBooster: Configure Permissions** to grant access.",
        );
        return;
      }

      const originalPrompt = request.prompt;

      // Get the language model for optimization
      const model = await this.modelSelector.getModelAutomatically();
      if (!model) {
        this.outputChannel.appendLine("No language model available");
        stream.markdown(
          "⚠️ No language model available. Please ensure GitHub Copilot is active.",
        );
        return;
      }

      this.outputChannel.appendLine(`Using model: ${model.name} (${model.id})`);

      // Build enhanced prompt with context from references
      const promptWithContext = this.buildPromptWithContext(
        originalPrompt,
        request,
      );

      // Log reference count
      if (request.references && request.references.length > 0) {
        this.outputChannel.appendLine(
          `Including ${request.references.length} reference(s)`,
        );
      }

      // Optimize prompt with timeout
      let optimizedPrompt: string | undefined;

      try {
        stream.progress("Optimizing your prompt...");

        optimizedPrompt = await Promise.race([
          this.optimizer.optimize(promptWithContext, model, token),
          this.createTimeout(this.timeoutMs),
        ]);
        
        // Render the response with buttons
        if (optimizedPrompt) {
            this.renderInteractiveResponse(originalPrompt, optimizedPrompt, stream);
        }

      } catch (error) {
        // If optimization fails or times out, use prompt with context
        this.outputChannel.appendLine(
          `Optimization failed: ${error instanceof Error ? error.message : String(error)}`,
        );

        if (token.isCancellationRequested) {
          stream.markdown("⚠️ Optimization cancelled.");
          return;
        }

        stream.markdown(
          "⚠️ Optimization timed out or failed. Falling back to original prompt.\n\n",
        );
        
        // Show original prompt buttons even on failure? 
        // For now just error out gracefully
      }

    } catch (error) {
      this.outputChannel.appendLine(`Error: ${error}`);
      stream.markdown(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Render the optimized prompt and interactive buttons
   */
  private renderInteractiveResponse(
      original: string, 
      optimized: string, 
      stream: vscode.ChatResponseStream
    ) {
      
      stream.markdown(`**Optimized Prompt**\n\n`);
      
      // Use block quote or code block to highlight the prompt
      stream.markdown(`> ${optimized.replace(/\n/g, "\n> ")}\n\n`);
      
      // Add actionable buttons
      stream.button({
          command: 'promptBooster.runPrompt',
          title: '🚀 Run Optimized',
          arguments: [optimized]
      });

      stream.button({
        command: 'promptBooster.createPromptFile',
        title: '✏️ Edit in File',
        arguments: [original, optimized]
      });

      stream.button({
          command: 'promptBooster.runPrompt',
          title: '↩️ Use Original',
          arguments: [original]
      });
  }

  /**
   * Build enhanced prompt with context from references
   */
  private buildPromptWithContext(
    prompt: string,
    request: vscode.ChatRequest,
  ): string {
    let enhancedPrompt = prompt;

    // Add reference context if available (#selection, #file, etc.)
    if (request.references && request.references.length > 0) {
      const referenceContext = request.references
        .map((ref) => {
          // Handle different reference types
          if (ref.value instanceof vscode.Uri) {
            // File reference (#file)
            return `File: ${ref.value.fsPath}`;
          } else if (ref.value instanceof vscode.Location) {
            // Location/selection reference (#selection, #editor)
            return `Location: ${ref.value.uri.fsPath}:${ref.value.range.start.line}`;
          } else if (typeof ref.value === "string") {
            // Text reference
            return `Context: ${ref.value}`;
          } else if (
            ref.value &&
            typeof ref.value === "object" &&
            "range" in ref.value &&
            "uri" in ref.value
          ) {
            // vscode.Range with URI
            try {
              const document = vscode.workspace.textDocuments.find(
                (doc) =>
                  doc.uri.toString() === (ref.value as any).uri.toString(),
              );
              if (document) {
                const range = (ref.value as any).range as vscode.Range;
                const text = document.getText(range);
                return `Selection from ${document.fileName}:\n\`\`\`\n${text}\n\`\`\``;
              }
            } catch (e) {
              // Fallback
            }
          }
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

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<string> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Optimization timed out after ${ms}ms`));
      }, ms);
    });
  }
}
