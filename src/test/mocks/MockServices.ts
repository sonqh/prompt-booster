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

  // Helpers for testing
  setAutoOptimize(enabled: boolean) {
    this.autoOptimize = enabled;
  }
  setPermission(granted: boolean) {
    this.permission = granted;
  }
}

/**
 * Mock File System
 */
export class MockFileSystem implements IFileSystem {
  public files: Map<string, string> = new Map();
  public directories: Set<string> = new Set();
  public workspacePath: string = "/mock/workspace";

  async readFile(path: string): Promise<string> {
    return this.files.get(path) || "";
  }
  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
  async createDirectory(path: string): Promise<void> {
    this.directories.add(path);
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
