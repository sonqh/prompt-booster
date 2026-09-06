/**
 * Realtime Mode Strategy
 *
 * Intercepts Copilot Chat prompts and applies all four PromptBooster enhancements:
 *   1. Tool-Aware Prompt Transformation  (ToolAffinityClassifier)
 *   2. Rich Workspace Context Gathering  (WorkspaceContextGatherer)
 *   3. VS Code Reference Resolution      (ReferenceResolver)
 *   4. MCP-Aware Tool Provisioning       (MCPToolRegistry)
 *
 * Shows an interactive preview with Apply / Refine / Use Original buttons.
 */
import * as vscode from "vscode";
import { IModeStrategy } from "./IModeStrategy";
import { IPromptOptimizationService } from "../services/IPromptOptimizationService";
import { ILanguageModelProvider } from "../models/ILanguageModelProvider";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";
import { ModeExecutionContext } from "../../shared/types/PromptResult";
import { OperationMode } from "../../shared/types/OperationMode";
import { WorkspaceContextGatherer } from "../services/WorkspaceContextGatherer";
import { ReferenceResolver } from "../services/ReferenceResolver";
import { MCPToolRegistry } from "../services/MCPToolRegistry";
import { classifyTools, MCPToolDescriptor } from "../services/ToolAffinityClassifier";
import {
  IPromptFeedbackLog,
  PendingFeedbackInput,
} from "../services/PromptFeedbackLog";

export class RealtimeModeStrategy implements IModeStrategy {
  private readonly timeoutMs = 20000; // 20 second timeout

  constructor(
    private optimizer: IPromptOptimizationService,
    private modelProvider: ILanguageModelProvider,
    private configManager: IConfigurationManager,
    private logger: ILogger,
    private contextGatherer: WorkspaceContextGatherer,
    private referenceResolver: ReferenceResolver,
    private mcpToolRegistry: MCPToolRegistry,
    private promptFeedbackLog: IPromptFeedbackLog,
  ) {}

  canHandle(mode: OperationMode): boolean {
    return (
      mode === "realtime" || this.configManager.isSimplifiedContextModeEnabled()
    );
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

    const isSimplified = this.configManager.isSimplifiedContextModeEnabled();

    if (!isSimplified && !this.configManager.isAutoOptimizeEnabled()) {
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

    // Build enriched prompt (Enhancements 1–4)
    const { promptWithContext, suggestedTools, mcpTools } =
      await this.buildPromptWithContext(request.prompt, request);

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
        // Attach classified tool metadata to result for callers
        result.suggestedTools = suggestedTools;
        result.mcpTools = mcpTools.map((t) => ({
          server: t.serverName,
          tool: t.toolName,
        }));

        // Phase E1: create the pending feedback record at render time; its id
        // rides back through the chat buttons. Capture is fire-and-forget —
        // a failing feedback log must never break the enhance.
        const feedbackId = this.captureFeedback(
          request,
          result.enhancedPrompt,
          result.intent,
          suggestedTools,
          mcpTools,
        );

        this.renderInteractiveResponse(
          request.prompt,
          result.enhancedPrompt,
          result.intent,
          suggestedTools,
          mcpTools,
          stream,
          feedbackId,
        );
      }
    } catch (error) {
      this.logger.error("Optimization failed", error as Error);
      stream.markdown(
        "⚠️ Optimization timed out or failed. Falling back to original prompt.\n\n",
      );
    }
  }

  // ─── Response rendering ────────────────────────────────────────────────────

  private renderInteractiveResponse(
    original: string,
    optimized: string,
    intent: "ask" | "edit",
    suggestedTools: ReturnType<typeof classifyTools>["suggestedTools"],
    mcpTools: MCPToolDescriptor[],
    stream: vscode.ChatResponseStream,
    feedbackId?: string,
  ) {
    stream.markdown("**Optimized Prompt**\n\n");
    stream.markdown(`_Detected Intent: ${intent.toUpperCase()}_\n\n`);

    // Tool tags (built-in)
    if (suggestedTools.length > 0) {
      stream.markdown(
        `_Detected Tools: ${suggestedTools.map((t) => `\`${t}\``).join(" · ")}_\n\n`,
      );
    }

    // MCP tool tags (source-annotated: foreign opt-in tools are marked as
    // coming from another editor's config so the user understands the caveat)
    if (mcpTools.length > 0) {
      const tags = mcpTools
        .map((t) =>
          t.visibility === "foreign"
            ? `\`${t.qualifiedName}\` (other-editor)`
            : `\`${t.qualifiedName}\``,
        )
        .join(" · ");
      stream.markdown(`_MCP Tools: ${tags}_\n\n`);
    }

    stream.markdown(`> ${optimized.replace(/\n/g, "\n> ")}\n\n`);

    // Buttons carry [text, feedbackId, outcome] when feedback capture is on;
    // the trailing arguments are optional so the commands keep working
    // without them (graceful no-feedback path, e.g. capture disabled).
    if (intent === "edit") {
      stream.button({
        command: "promptBooster.runPrompt",
        title: "$(sparkle) Apply to Chat",
        tooltip: "Copy optimized prompt to Copilot Chat",
        arguments: feedbackId
          ? [optimized, feedbackId, "accept"]
          : [optimized],
      });
      stream.button({
        command: "promptBooster.createPromptFile",
        title: "$(edit) Refine in File",
        tooltip: "Open in editor for manual refinement",
        arguments: feedbackId
          ? [original, optimized, feedbackId]
          : [original, optimized],
      });
    } else {
      stream.button({
        command: "promptBooster.runPrompt",
        title: "$(comment-discussion) Ask in Chat",
        tooltip: "Copy enhanced question to Copilot Chat",
        arguments: feedbackId
          ? [optimized, feedbackId, "accept"]
          : [optimized],
      });
      stream.button({
        command: "promptBooster.createPromptFile",
        title: "$(edit) Edit",
        tooltip: "Edit prompt before sending",
        arguments: feedbackId
          ? [original, optimized, feedbackId]
          : [original, optimized],
      });
    }

    stream.button({
      command: "promptBooster.runPrompt",
      title: "$(reply) Use Original",
      tooltip: "Revert to original prompt",
      arguments: feedbackId ? [original, feedbackId, "reject"] : [original],
    });
  }

  /**
   * Best-effort observation of the chat request's tool calls. The current
   * chat API does not reliably expose these — feature-detect and degrade.
   */
  private extractObservedToolCalls(
    request: vscode.ChatRequest,
  ): string[] | undefined {
    const calls = (request as { toolCalls?: unknown }).toolCalls;
    if (!Array.isArray(calls) || calls.length === 0) return undefined;
    const names = calls
      .map((call) =>
        call && typeof call === "object" && "name" in call
          ? String((call as { name: unknown }).name)
          : undefined,
      )
      .filter((name): name is string => !!name);
    return names.length > 0 ? names : undefined;
  }

  /** Create the pending feedback record; never throws across the enhance. */
  private captureFeedback(
    request: vscode.ChatRequest,
    enhancedPrompt: string,
    intent: "ask" | "edit",
    suggestedTools: ReturnType<typeof classifyTools>["suggestedTools"],
    mcpTools: MCPToolDescriptor[],
  ): string | undefined {
    if (!this.promptFeedbackLog) return undefined;
    if (
      !this.configManager.getFeedbackLearningOptions().feedbackEnabled
    ) {
      return undefined; // master switch off — no capture (service double-checks)
    }
    try {
      const observedToolCalls = this.extractObservedToolCalls(request);
      const input: PendingFeedbackInput = {
        rawPrompt: request.prompt,
        enhancedPrompt,
        intent,
        builtinToolTags: [...suggestedTools],
        mcpRefs: mcpTools.map((t) => t.qualifiedName),
        catalogFingerprint: this.mcpToolRegistry.getCatalogFingerprint(),
        ...(observedToolCalls ? { observedToolCalls } : {}),
      };
      return this.promptFeedbackLog.createPending(input);
    } catch (error) {
      this.logger.warn(
        `RealtimeModeStrategy: feedback capture failed — enhance unaffected (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return undefined;
    }
  }

  // ─── Prompt assembly (Enhancements 1–4) ───────────────────────────────────

  private async buildPromptWithContext(
    prompt: string,
    request: vscode.ChatRequest,
  ): Promise<{
    promptWithContext: string;
    suggestedTools: ReturnType<typeof classifyTools>["suggestedTools"];
    mcpTools: MCPToolDescriptor[];
  }> {
    const parts: string[] = [];

    // Enhancement 2: Rich workspace context preamble
    const wsCtx = await this.contextGatherer.gather();
    const preamble = this.contextGatherer.formatAsPromptPreamble(wsCtx);
    if (preamble) parts.push(preamble);

    // Enhancement 3a: Resolve inline tokens (#file:, #selection, #editor, …)
    const { cleanPrompt, resolved: inlineResolved } =
      await this.referenceResolver.resolveInlineTokens(prompt);

    // Enhancement 3b: Resolve drag-and-drop / autocomplete references
    const explicitResolved =
      request.references?.length
        ? await this.referenceResolver.resolve(request.references)
        : "";

    if (inlineResolved.length > 0) {
      parts.push(this.referenceResolver.formatResolved(inlineResolved));
    }
    if (explicitResolved) parts.push(explicitResolved);

    // Enhancement 4: Discover MCP tools (cached; stale-while-revalidate) and
    // filter to what the downstream Copilot agent can execute. Foreign-source
    // tools (other editors' configs) are excluded unless the user opts in —
    // when included they carry an explicit "only use if available" annotation.
    await this.mcpToolRegistry.ensureCatalog();
    const { includeForeignServers } =
      this.configManager.getMcpProvisioningOptions();
    const mcpCatalog = includeForeignServers
      ? this.mcpToolRegistry.getToolCatalog()
      : this.mcpToolRegistry.getInjectableCatalog();

    // Enhancement 1 + 4: Classify built-in and MCP tools
    const { suggestedTools, mcpTools, toolAnnotations } = classifyTools(
      cleanPrompt,
      mcpCatalog,
    );

    // Inject the filtered MCP catalog so the LLM knows what's available
    if (mcpTools.length > 0) {
      parts.push(this.mcpToolRegistry.formatForSystemPrompt(mcpTools));
    }

    // Append user request + tool placement guidance
    parts.push(
      `### User Request\n${cleanPrompt}${
        toolAnnotations ? "\n\n" + toolAnnotations : ""
      }`,
    );

    return {
      promptWithContext: parts.join("\n\n"),
      suggestedTools,
      mcpTools,
    };
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Optimization timed out after ${ms}ms`));
      }, ms);
    });
  }
}
