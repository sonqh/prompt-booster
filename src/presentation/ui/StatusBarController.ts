/**
 * Status Bar Controller - Manages mode display in VS Code status bar
 */
import * as vscode from "vscode";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";
import { OperationMode } from "../../shared/types/OperationMode";

export class StatusBarController implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );

    // Set up click command
    this.statusBarItem.command = "promptBooster.switchMode";
    this.statusBarItem.tooltip = "Click to switch PromptBooster mode";

    // Initial update
    this.updateStatusBar();

    // Show the status bar item
    this.statusBarItem.show();

    this.logger.log("StatusBarController initialized");
  }

  /**
   * Update status bar display based on current mode
   */
  updateStatusBar(): void {
    const mode = this.configManager.getOperationMode();
    const modeIcon = this.getModeIcon(mode);
    const modeName = this.getModeName(mode);

    this.statusBarItem.text = `$(${modeIcon}) ${modeName}`;
  }

  private getModeIcon(mode: OperationMode): string {
    switch (mode) {
      case "manual":
        return "wand";
      case "realtime":
        return "rocket";
      case "file":
        return "new-file";
      default:
        return "question";
    }
  }

  private getModeName(mode: OperationMode): string {
    switch (mode) {
      case "manual":
        return "Manual";
      case "realtime":
        return "Realtime";
      case "file":
        return "File";
      default:
        return "Unknown";
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
