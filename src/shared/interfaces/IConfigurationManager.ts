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
   * Check if user has granted permission
   */
  hasPermission(): Promise<boolean>;

  /**
   * Request permission from user
   */
  requestPermission(): Promise<boolean>;
}
