/**
 * Configuration manager interface - abstraction for configuration access
 */

import { OperationMode } from "../types/OperationMode";

export interface IConfigurationManager {
  /**
   * Get the current operation mode
   */
  getOperationMode(): OperationMode;

  /**
   * Set the operation mode
   */
  setOperationMode(mode: OperationMode): Promise<void>;

  /**
   * Check if auto-optimization is enabled
   */
  isAutoOptimizeEnabled(): boolean;

  /**
   * Toggle auto-optimization setting
   */
  toggleAutoOptimize(): Promise<void>;

  /**
   * Check if preview should be shown
   */
  isShowPreviewEnabled(): boolean;

  /**
   * Get the file output directory
   */
  getFileOutputDirectory(): string;

  /**
   * Get the file naming pattern
   */
  getFileNamingPattern(): "timestamp" | "prompt" | "custom";

  /**
   * Get the preferred AI model
   */
  getModelPreference(): string;

  /**
   * Set the preferred AI model
   */
  setModelPreference(model: string): Promise<void>;

  /**
   * Check if user has granted permission
   */
  hasPermission(): Promise<boolean>;

  /**
   * Check if simplified context-based mode is enabled
   */
  isSimplifiedContextModeEnabled(): boolean;

  /**
   * Request permission from user
   */
  requestPermission(): Promise<boolean>;

  /**
   * MCP provisioning options (Enhancement 4 v2). Read from the
   * `promptBooster.mcp.*` settings — cheap, synchronous, safe to call
   * on every request.
   */
  getMcpProvisioningOptions(): {
    /** Opt-in: spawn stdio MCP servers in the background to list their tools. */
    probeServers: boolean;
    /** Opt-in: inject tools discovered from other editors' configs (annotated). */
    includeForeignServers: boolean;
    /** How long a discovered catalog stays trusted before revalidation. */
    cacheTtlMinutes: number;
  };

  /**
   * Feedback / response-cache / learning options (Enhancement 4 v2, Phase E).
   * Read from the `promptBooster.feedback.*`, `.cache.*`, and `.learning.*`
   * settings — cheap, synchronous, safe to call on every request.
   */
  getFeedbackLearningOptions(): {
    /** Master switch for decision capture (workspace-local only). */
    feedbackEnabled: boolean;
    /** Resolved-record ring cap. */
    historyLimit: number;
    /** Optimizer response cache master switch. */
    cacheEnabled: boolean;
    /** Entry re-validation window, in days. */
    cacheTtlDays: number;
    /** LRU cap for cached optimizer responses. */
    cacheMaxEntries: number;
    /** Opt in: send confirmed-accepted prompts back as few-shot examples. */
    fewShotFromFeedback: boolean;
    /** Few-shot example count cap. */
    maxFewShotExamples: number;
    /** Total char budget for the few-shot block. */
    fewShotCharBudget: number;
  };
}
