import * as vscode from "vscode";

/**
 * VS Code Copilot built-in tool reference identifiers.
 * Defined here (shared layer) so both PromptResult and ToolAffinityClassifier
 * can reference the same type without a cross-layer dependency.
 */
export type CopilotTool =
  | "#file"
  | "#selection"
  | "#editor"
  | "#codebase"
  | "#terminalLastCommand"
  | "#terminalSelection"
  | "@workspace"
  | "@terminal"
  | "@vscode";


/**
 * Result of prompt optimization
 */
export interface PromptResult {
  /**
   * The enhanced/optimized prompt
   */
  enhancedPrompt: string;

  /**
   * Detected intent (ask vs edit)
   */
  intent: "ask" | "edit";

  /**
   * VS Code Copilot built-in tool references detected in the prompt
   * (e.g. "#file", "@workspace"). Optional — absent when none matched.
   */
  suggestedTools?: CopilotTool[];

  /**
   * MCP tool references from the user's workspace config that match the prompt.
   * Optional — absent when no MCP servers are configured or none matched.
   */
  mcpTools?: { server: string; tool: string }[];
}


/**
 * Options for prompt optimization
 */
export interface OptimizationOptions {
  /**
   * The AI model to use
   */
  model: vscode.LanguageModelChat;

  /**
   * Cancellation token for the optimization operation
   */
  cancellationToken?: vscode.CancellationToken;
}

/**
 * Context for mode execution
 */
export interface ModeExecutionContext {
  /**
   * The prompt to process
   */
  prompt: string;

  /**
   * Optional document URI
   */
  documentUri?: string;

  /**
   * Optional selection range
   */
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}
