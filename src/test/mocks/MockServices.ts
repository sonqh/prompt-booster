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
import { computeResponseCacheKey } from "../../core/services/PromptResponseCache";
import type { GoldenSetCandidate } from "../../core/services/PromptLearningStore";
import {
  CachedPromptResponse,
  ConfirmedPromptPair,
} from "../../shared/types/PromptFeedbackTypes";

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
  /**
   * Feedback/cache/learning defaults mirror the real ConfigurationManager
   * (feedback + cache on, few-shot OFF — the privacy-sensitive opt-in).
   */
  private feedbackLearning: {
    feedbackEnabled: boolean;
    historyLimit: number;
    cacheEnabled: boolean;
    cacheTtlDays: number;
    cacheMaxEntries: number;
    fewShotFromFeedback: boolean;
    maxFewShotExamples: number;
    fewShotCharBudget: number;
  } = {
    feedbackEnabled: true,
    historyLimit: 200,
    cacheEnabled: true,
    cacheTtlDays: 7,
    cacheMaxEntries: 200,
    fewShotFromFeedback: false,
    maxFewShotExamples: 5,
    fewShotCharBudget: 2000,
  };

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

  getFeedbackLearningOptions(): {
    feedbackEnabled: boolean;
    historyLimit: number;
    cacheEnabled: boolean;
    cacheTtlDays: number;
    cacheMaxEntries: number;
    fewShotFromFeedback: boolean;
    maxFewShotExamples: number;
    fewShotCharBudget: number;
  } {
    return { ...this.feedbackLearning };
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
  setFeedbackLearningOptions(options: Partial<{
    feedbackEnabled: boolean;
    historyLimit: number;
    cacheEnabled: boolean;
    cacheTtlDays: number;
    cacheMaxEntries: number;
    fewShotFromFeedback: boolean;
    maxFewShotExamples: number;
    fewShotCharBudget: number;
  }>) {
    this.feedbackLearning = { ...this.feedbackLearning, ...options };
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
 * Mock Prompt Feedback Log — records calls for assertion and optionally throws
 * to prove the strategy's fire-and-forget posture (capture failures never
 * break the enhance).
 */
export class MockPromptFeedbackLog {
  public createPendingCalls: unknown[] = [];
  public resolveCalls: Array<{ feedbackId: string; outcome: string }> = [];
  public finalizeCalls: Array<{ feedbackId: string; finalText: string }> = [];
  /** When true, createPending throws (failure-posture tests). */
  public failCreate = false;
  private nextId = 0;

  createPending(input: unknown): string | undefined {
    if (this.failCreate) throw new Error("mock feedback log failure");
    this.createPendingCalls.push(input);
    return `feedback-${++this.nextId}`;
  }

  resolve(feedbackId: string, outcome: string): void {
    this.resolveCalls.push({ feedbackId, outcome });
  }

  finalizeEdit(feedbackId: string, finalText: string): void {
    this.finalizeCalls.push({ feedbackId, finalText });
  }

  getConfirmedPositives(): unknown[] {
    return [];
  }

  getReport(): unknown {
    return {
      pending: 0,
      funnel: { accept: 0, reject: 0, "edit-opened": 0, "edit-finalized": 0 },
      acceptanceRate: null,
      retentionRate: null,
      retainedRefs: 0,
      removedRefs: 0,
      observedToolCallRecords: 0,
      observedToolCallPrecision: null,
    };
  }
}

/**
 * Mock Prompt Response Cache — mirrors IPromptResponseCache for strategy
 * tests: seedable entries (keyed by the real key formula so lookups stay in
 * sync with what the strategy computes), call recording, an `enabled` flag
 * mimicking `promptBooster.cache.enabled: false`, and throwing flags to prove
 * the strategy's failure posture (a broken cache never breaks the enhance).
 */
export class MockPromptResponseCache {
  public computeKeyCalls: Array<{
    rawPrompt: string;
    catalogFingerprint: string;
    fewShotStamp: string;
  }> = [];
  public getCalls: string[] = [];
  public putCalls: Array<{
    key: string;
    enhancedPrompt: string;
    intent: "ask" | "edit";
  }> = [];
  /** When true, get/put throw (failure-posture tests). */
  public failGet = false;
  public failPut = false;
  /** Mimics `promptBooster.cache.enabled: false` — always miss, put no-op. */
  public enabled = true;
  private entries = new Map<string, CachedPromptResponse>();

  /** Number of currently stored entries (disabled puts store nothing). */
  get entryCount(): number {
    return this.entries.size;
  }

  computeKey(
    rawPrompt: string,
    catalogFingerprint: string,
    fewShotStamp: string,
  ): string {
    this.computeKeyCalls.push({ rawPrompt, catalogFingerprint, fewShotStamp });
    // Delegate to the real pure key formula so seeded entries match what the
    // strategy will actually compute for the same inputs.
    return computeResponseCacheKey(rawPrompt, catalogFingerprint, fewShotStamp);
  }

  /** Seed an entry exactly the way the strategy will look it up. */
  setEntry(
    rawPrompt: string,
    catalogFingerprint: string,
    fewShotStamp: string,
    response: CachedPromptResponse,
  ): void {
    this.entries.set(
      computeResponseCacheKey(rawPrompt, catalogFingerprint, fewShotStamp),
      { ...response },
    );
  }

  async get(key: string): Promise<CachedPromptResponse | undefined> {
    if (this.failGet) throw new Error("mock response-cache get failure");
    this.getCalls.push(key);
    if (!this.enabled) return undefined;
    const hit = this.entries.get(key);
    return hit ? { ...hit } : undefined;
  }

  put(key: string, enhancedPrompt: string, intent: "ask" | "edit"): void {
    if (this.failPut) throw new Error("mock response-cache put failure");
    this.putCalls.push({ key, enhancedPrompt, intent });
    if (!this.enabled) return;
    this.entries.set(key, {
      enhancedPrompt,
      intent,
      createdAt: Date.now(),
      hitCount: 0,
    });
  }

  getCacheStats(): { hits: number; misses: number; hitRate: number | null } {
    return { hits: 0, misses: 0, hitRate: null };
  }
}

/**
 * Mock Learning Store — mirrors IPromptLearningStore for strategy tests:
 * configurable confirmed pairs, call recording (including the selection
 * options the strategy passes), and a throwing flag to prove the strategy's
 * failure posture (a broken learning store degrades to no few-shot block and
 * an empty cache stamp, never an enhance failure).
 */
export class MockLearningStore {
  /** Confirmed pairs returned by getFewShotExamples (copies, most recent first). */
  public fewShotExamples: ConfirmedPromptPair[] = [];
  /** Candidates returned by getGoldenSetCandidates. */
  public goldenCandidates: GoldenSetCandidate[] = [];
  public getFewShotExamplesCalls: unknown[] = [];
  public getGoldenSetCandidatesCalls = 0;
  /** When true, getFewShotExamples throws (failure-posture tests). */
  public failFewShot = false;

  async getFewShotExamples(
    options?: unknown,
  ): Promise<ConfirmedPromptPair[]> {
    if (this.failFewShot) throw new Error("mock learning store failure");
    this.getFewShotExamplesCalls.push(options);
    return this.fewShotExamples.map((e) => ({
      ...e,
      retainedRefs: [...e.retainedRefs],
    }));
  }

  async getGoldenSetCandidates(): Promise<GoldenSetCandidate[]> {
    this.getGoldenSetCandidatesCalls++;
    return this.goldenCandidates.map((c) => ({
      ...c,
      expectedTools: [...c.expectedTools],
    }));
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

