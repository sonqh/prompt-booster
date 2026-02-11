/**
 * Mode Strategy Interface
 * Defines the contract for different operation modes
 */
import { OperationMode } from "../../shared/types/OperationMode";
import { ModeExecutionContext } from "../../shared/types/PromptResult";

export interface IModeStrategy {
  /**
   * Execute the mode's primary action
   */
  execute(context: ModeExecutionContext): Promise<void>;

  /**
   * Check if this strategy handles the given mode
   */
  canHandle(mode: OperationMode): boolean;
}
