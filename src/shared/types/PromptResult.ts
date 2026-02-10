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
}

/**
 * Options for prompt optimization
 */
export interface OptimizationOptions {
  /**
   * The AI model to use
   */
  model: any; // Will be typed properly when we implement ILanguageModelProvider

  /**
   * Cancellation token
   */
  cancellationToken?: any;
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
