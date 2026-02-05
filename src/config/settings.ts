/**
 * Configuration management and mode manager for PromptBooster
 */

import * as vscode from "vscode";

export type OperationMode = "manual" | "realtime" | "file";

export class ModeManager {
  private mode: OperationMode;
  private readonly onModeChangedEmitter =
    new vscode.EventEmitter<OperationMode>();
  public readonly onModeChanged = this.onModeChangedEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.mode = this.loadMode();

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("promptBooster.operationMode")) {
        this.mode = this.loadMode();
        this.onModeChangedEmitter.fire(this.mode);
      }
    });
  }

  getMode(): OperationMode {
    return this.mode;
  }

  async setMode(mode: OperationMode): Promise<void> {
    this.mode = mode;
    await this.saveMode();
    this.onModeChangedEmitter.fire(mode);
  }

  isAutoOptimizeEnabled(): boolean {
    return vscode.workspace
      .getConfiguration("promptBooster")
      .get("autoOptimize", false);
  }

  async toggleAutoOptimize(): Promise<void> {
    const config = vscode.workspace.getConfiguration("promptBooster");
    const current = config.get("autoOptimize", false);
    await config.update(
      "autoOptimize",
      !current,
      vscode.ConfigurationTarget.Global,
    );
  }

  isShowPreviewEnabled(): boolean {
    return vscode.workspace
      .getConfiguration("promptBooster")
      .get("showPreview", true);
  }

  getFileOutputDirectory(): string {
    return vscode.workspace
      .getConfiguration("promptBooster")
      .get("fileOutputDirectory", ".github/prompts");
  }

  getFileNamingPattern(): "timestamp" | "prompt" | "custom" {
    return vscode.workspace
      .getConfiguration("promptBooster")
      .get("fileNamingPattern", "prompt");
  }

  getModelPreference(): string {
    return vscode.workspace
      .getConfiguration("promptBooster")
      .get("modelPreference", "gpt-4.1");
  }

  async checkPermission(): Promise<boolean> {
    const permissionGranted =
      this.context.globalState.get<boolean>("permissionGranted");

    if (permissionGranted === undefined) {
      // First run - show permission dialog
      return await this.requestPermission();
    }

    return permissionGranted;
  }

  async requestPermission(): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      "PromptBooster wants to optimize your prompts before sending to Copilot.\n\n" +
        "This will:\n" +
        "• Intercept chat prompts when auto-optimization is enabled\n" +
        "• Send prompts to AI model for enhancement\n" +
        "• Show preview before submitting to Copilot\n\n" +
        "You can disable this anytime in settings.",
      { modal: true },
      "Allow",
      "Not Now",
      "Never",
    );

    if (result === "Allow") {
      await this.context.globalState.update("permissionGranted", true);
      return true;
    } else if (result === "Never") {
      await this.context.globalState.update("permissionGranted", false);
      return false;
    }

    // "Not Now" - don't store anything, ask again later
    return false;
  }

  async configurePermissions(): Promise<void> {
    const result = await vscode.window.showQuickPick(
      [
        {
          label: "$(check) Allow",
          description: "Enable prompt interception and optimization",
          value: true,
        },
        {
          label: "$(x) Deny",
          description: "Disable prompt interception (manual mode only)",
          value: false,
        },
      ],
      {
        placeHolder: "Configure PromptBooster permissions",
      },
    );

    if (result) {
      await this.context.globalState.update("permissionGranted", result.value);
    }
  }

  private loadMode(): OperationMode {
    return vscode.workspace
      .getConfiguration("promptBooster")
      .get("operationMode", "manual");
  }

  private async saveMode(): Promise<void> {
    await vscode.workspace
      .getConfiguration("promptBooster")
      .update("operationMode", this.mode, vscode.ConfigurationTarget.Global);
  }

  dispose() {
    this.onModeChangedEmitter.dispose();
  }
}
