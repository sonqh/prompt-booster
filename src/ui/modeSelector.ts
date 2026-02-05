/**
 * Mode selector status bar UI
 */

import * as vscode from "vscode";
import { ModeManager, OperationMode } from "../config/settings";

const MODE_ICONS = {
  manual: "🔧",
  realtime: "⚡",
  file: "📝",
};

const MODE_DESCRIPTIONS = {
  manual: "Manual - Boost prompts on demand",
  realtime: "Real-time - Auto-optimize with preview",
  file: "File - Generate editable prompt files",
};

export class ModeStatusBar {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private modeManager: ModeManager) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "promptBooster.switchMode";

    this.updateStatusBar();
    this.statusBarItem.show();

    // Listen for mode changes
    modeManager.onModeChanged(() => this.updateStatusBar());
  }

  private updateStatusBar() {
    const mode = this.modeManager.getMode();
    this.statusBarItem.text = `${MODE_ICONS[mode]} ${this.capitalize(mode)}`;
    this.statusBarItem.tooltip = MODE_DESCRIPTIONS[mode];
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async showModeSwitcher(): Promise<void> {
    const currentMode = this.modeManager.getMode();

    const items = [
      {
        label: `${MODE_ICONS.manual} Manual`,
        description: MODE_DESCRIPTIONS.manual,
        detail:
          currentMode === "manual" ? "$(check) Currently active" : undefined,
        mode: "manual" as OperationMode,
      },
      {
        label: `${MODE_ICONS.realtime} Real-time`,
        description: MODE_DESCRIPTIONS.realtime,
        detail:
          currentMode === "realtime" ? "$(check) Currently active" : undefined,
        mode: "realtime" as OperationMode,
      },
      {
        label: `${MODE_ICONS.file} File`,
        description: MODE_DESCRIPTIONS.file,
        detail:
          currentMode === "file" ? "$(check) Currently active" : undefined,
        mode: "file" as OperationMode,
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select PromptBooster operation mode",
    });

    if (selected && selected.mode !== currentMode) {
      await this.modeManager.setMode(selected.mode);
      vscode.window.showInformationMessage(
        `PromptBooster mode switched to: ${this.capitalize(selected.mode)}`,
      );
    }
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}
