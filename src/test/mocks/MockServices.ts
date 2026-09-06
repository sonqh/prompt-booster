import * as vscode from "vscode";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import {
  IProgressService,
  IProgressReporter,
  ProgressOptions,
} from "../../shared/interfaces/IProgressReporter";
import { ILanguageModelProvider } from "../../core/models/ILanguageModelProvider";
import { IPromptOptimizationService } from "../../core/services/IPromptOptimizationService";
import { OperationMode } from "../../shared/types/OperationMode";
import {
  OptimizationOptions,
  PromptResult,
} from "../../shared/types/PromptResult";

/**
 * Mock Configuration Manager
 */
export class MockConfigurationManager implements IConfigurationManager {
  private mode: OperationMode = "manual";
  private autoOptimize: boolean = false;
  private preview: boolean = true;
  private permission: boolean = true;
  private outputDir: string = ".github/prompts";
  private namingPattern: "timestamp" | "prompt" | "custom" = "prompt";
  private modelPreference: string = "gpt-4.1";
  /**
   * Simplified-context default is FALSE in the mock (the real extension
   * defaults to true): strategy unit tests assert non-simplified behavior
   * and opt in explicitly when they need it.
   */
  private simplifiedContextMode: boolean = false;
  private mcpProvisioning: {
    probeServers: boolean;
    includeForeignServers: boolean;
    cacheTtlMinutes: number;
  } = { probeServers: false, includeForeignServers: false, cacheTtlMinutes: 10 };

  getOperationMode(): OperationMode {
    return this.mode;
  }
  async setOperationMode(mode: OperationMode): Promise<void> {
    this.mode = mode;
  }
  isAutoOptimizeEnabled(): boolean {
    return this.autoOptimize;
  }
  async toggleAutoOptimize(): Promise<void> {
    this.autoOptimize = !this.autoOptimize;
  }
  isShowPreviewEnabled(): boolean {
    return this.preview;
  }
  getFileOutputDirectory(): string {
    return this.outputDir;
  }
  getFileNamingPattern(): "timestamp" | "prompt" | "custom" {
    return this.namingPattern;
  }
  getModelPreference(): string {
    return this.modelPreference;
  }
  async setModelPreference(model: string): Promise<void> {
    this.modelPreference = model;
  }
  async hasPermission(): Promise<boolean> {
    return this.permission;
  }
  async requestPermission(): Promise<boolean> {
    return true;
  }

  isSimplifiedContextModeEnabled(): boolean {
    return this.simplifiedContextMode;
  }

  getMcpProvisioningOptions(): {
    probeServers: boolean;
    includeForeignServers: boolean;
    cacheTtlMinutes: number;
  } {
    return { ...this.mcpProvisioning };
  }

  // Helpers for testing
  setAutoOptimize(enabled: boolean) {
    this.autoOptimize = enabled;
  }
  setPermission(granted: boolean) {
    this.permission = granted;
  }
  setSimplifiedContextMode(enabled: boolean) {
    this.simplifiedContextMode = enabled;
  }
  setMcpProvisioningOptions(options: Partial<{
    probeServers: boolean;
    includeForeignServers: boolean;
    cacheTtlMinutes: number;
  }>) {
    this.mcpProvisioning = { ...this.mcpProvisioning, ...options };
  }
}

/**
 * Mock File System
 */
export class MockFileSystem implements IFileSystem {
  public files: Map<string, string> = new Map();
  public directories: Set<string> = new Set();
  /** Explicit stat entries; `writeFile` auto-populates fingerprint stats. */
  public stats: Map<string, { mtimeMs: number; size: number }> = new Map();
  public workspacePath: string = "/mock/workspace";

  async readFile(path: string | vscode.Uri): Promise<string> {
    return this.files.get(this.toKey(path)) || "";
  }
  async writeFile(path: string | vscode.Uri, content: string): Promise<void> {
    const key = this.toKey(path);
    this.files.set(key, content);
    // Keep fingerprint stats coherent so mtime-based invalidation tests can
    // simply rewrite a file (explicit `stats.set` overrides when precise
    // values are needed).
    this.stats.set(key, { mtimeMs: Date.now(), size: content.length });
  }
  async fileExists(path: string | vscode.Uri): Promise<boolean> {
    return this.files.has(this.toKey(path));
  }
  async createDirectory(path: string | vscode.Uri): Promise<void> {
    this.directories.add(this.toKey(path));
  }
  async stat(
    path: string | vscode.Uri,
  ): Promise<{ mtimeMs: number; size: number } | undefined> {
    return this.stats.get(this.toKey(path));
  }

  private toKey(path: string | vscode.Uri): string {
    if (path instanceof vscode.Uri) {
      return path.fsPath;
    }
    return path;
  }
  getWorkspacePath(): string | undefined {
    return this.workspacePath;
  }
  joinPath(...segments: string[]): string {
    return segments.join("/");
  }
}

/**
 * Mock Progress Service
 */
export class MockProgressService implements IProgressService {
  async withProgress<T>(
    _options: ProgressOptions,
    task: (
      reporter: IProgressReporter,
      token: vscode.CancellationToken,
    ) => Promise<T>,
  ): Promise<T> {
    const reporter = {
      report: (_message: string) => {},
      reportProgress: (_increment: number) => {},
    };
    const tokenSource = new vscode.CancellationTokenSource();
    return await task(reporter, tokenSource.token);
  }
}

/**
 * Mock Language Model Provider
 */
export class MockLanguageModelProvider implements ILanguageModelProvider {
  private mockModel: any = {
    name: "mock-model",
    id: "mock-model-id",
    sendRequest: async () => {},
  };
  private shouldReturnNull = false;

  async getModel(
    _forcePrompt?: boolean,
  ): Promise<vscode.LanguageModelChat | undefined> {
    return this.shouldReturnNull ? undefined : this.mockModel;
  }
  async getModelAutomatically(): Promise<vscode.LanguageModelChat | undefined> {
    return this.shouldReturnNull ? undefined : this.mockModel;
  }
  async hasModels(): Promise<boolean> {
    return true;
  }
  resetLastUsedModel(): void {}

  setReturnNull(shouldReturnNull: boolean) {
    this.shouldReturnNull = shouldReturnNull;
  }
}

/**
 * Mock Prompt Optimization Service
 */
export class MockOptimizationService implements IPromptOptimizationService {
  public optimizeCalled = 0;
  public optimizeStructuredCalled = 0;

  async optimize(
    prompt: string,
    _options: OptimizationOptions,
  ): Promise<string> {
    this.optimizeCalled++;
    return `Optimized: ${prompt}`;
  }
  async optimizeStructured(
    prompt: string,
    _options: OptimizationOptions,
  ): Promise<PromptResult> {
    this.optimizeStructuredCalled++;
    return {
      enhancedPrompt: `Structured: ${prompt}`,
      intent: "ask",
    };
  }
  getSystemPrompt(): string {
    return "System Prompt";
  }
}

/**
 * Mock MCP Tool Registry — mirrors the MCPToolRegistry surface the strategies
 * consume: ensureCatalog() (cached discovery), getToolCatalog(),
 * getInjectableCatalog(), getCatalogFingerprint().
 */
export class MockMCPToolRegistry {
  public ensureCatalogCalled = 0;
  /** Kept for any legacy callers; ensureCatalog is the strategy's entry point. */
  public discoverCalled = 0;
  private catalog: import("../../core/services/MCPToolRegistry").MCPToolDescriptor[] =
    [];

  setMockCatalog(
    tools: import("../../core/services/MCPToolRegistry").MCPToolDescriptor[],
  ) {
    this.catalog = tools;
  }

  async ensureCatalog(): Promise<
    import("../../core/services/MCPToolRegistry").MCPToolDescriptor[]
  > {
    this.ensureCatalogCalled++;
    return this.getToolCatalog();
  }

  async discover(): Promise<void> {
    this.discoverCalled++;
  }

  getToolCatalog() {
    return this.catalog.filter((t) => t.enabled);
  }

  /** Injectable = enabled and not explicitly foreign (missing field = injectable). */
  getInjectableCatalog() {
    return this.catalog.filter(
      (t) => t.enabled && t.visibility !== "foreign",
    );
  }

  getCatalogFingerprint(): string {
    return "mock-fingerprint";
  }

  getServerNames(): string[] {
    return [...new Set(this.catalog.map((t) => t.serverName))];
  }

  formatForSystemPrompt(
    tools: import("../../core/services/MCPToolRegistry").MCPToolDescriptor[],
  ): string {
    if (tools.length === 0) return "";
    return tools
      .map((t) => `- \`${t.qualifiedName}\`: ${t.description}`)
      .join("\n");
  }
}

