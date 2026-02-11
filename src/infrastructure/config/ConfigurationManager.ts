/**
 * Configuration Manager - implements IConfigurationManager interface
 */
import * as vscode from "vscode";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager.js";
import { OperationMode } from "../../shared/types/OperationMode.js";

export class ConfigurationManager implements IConfigurationManager {
  private readonly configSection = "promptBooster";
  private context: vscode.ExtensionContext;
  private readonly onModeChangedEmitter =
    new vscode.EventEmitter<OperationMode>();
  public readonly onModeChanged = this.onModeChangedEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${this.configSection}.operationMode`)) {
        this.onModeChangedEmitter.fire(this.getOperationMode());
      }
    });
  }

  getOperationMode(): OperationMode {
    return this.getConfig<OperationMode>("operationMode", "manual");
  }

  async setOperationMode(mode: OperationMode): Promise<void> {
    await this.setConfig("operationMode", mode);
    this.onModeChangedEmitter.fire(mode);
  }

  isAutoOptimizeEnabled(): boolean {
    return this.getConfig<boolean>("autoOptimize", false);
  }

  async toggleAutoOptimize(): Promise<void> {
    const current = this.isAutoOptimizeEnabled();
    await this.setConfig("autoOptimize", !current);
  }

  isShowPreviewEnabled(): boolean {
    return this.getConfig<boolean>("showPreview", true);
  }

  getFileOutputDirectory(): string {
    return this.getConfig<string>("fileOutputDirectory", ".github/prompts");
  }

  getFileNamingPattern(): "timestamp" | "prompt" | "custom" {
    return this.getConfig<"timestamp" | "prompt" | "custom">(
      "fileNamingPattern",
      "prompt",
    );
  }

  getModelPreference(): string {
    return this.getConfig<string>("modelPreference", "gpt-4.1");
  }

  async setModelPreference(model: string): Promise<void> {
    await this.setConfig("modelPreference", model);
  }

  async hasPermission(): Promise<boolean> {
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
      "PromptBooster wants to optimize your prompts before sending to Copilot.\\n\\n" +
        "This will:\\n" +
        "• Intercept chat prompts when auto-optimization is enabled\\n" +
        "• Send prompts to AI model for enhancement\\n" +
        "• Show preview before submitting to Copilot\\n\\n" +
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

  /**
   * Helper to get configuration value
   */
  private getConfig<T>(key: string, defaultValue: T): T {
    return vscode.workspace
      .getConfiguration(this.configSection)
      .get<T>(key, defaultValue);
  }

  /**
   * Helper to set configuration value
   */
  private async setConfig(key: string, value: any): Promise<void> {
    await vscode.workspace
      .getConfiguration(this.configSection)
      .update(key, value, vscode.ConfigurationTarget.Global);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.onModeChangedEmitter.dispose();
  }
}
