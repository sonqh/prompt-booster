/**
 * Unit tests for ManualModeStrategy
 */
import * as assert from "assert";
import * as vscode from "vscode";
import { ManualModeStrategy } from "../../../core/strategies/ManualModeStrategy";
import {
  MockLanguageModelProvider,
  MockOptimizationService,
  MockProgressService,
} from "../../mocks/MockServices";
import { MockLogger } from "../../mocks/MockLogger";

suite("ManualModeStrategy Test Suite", () => {
  let strategy: ManualModeStrategy;
  let mockModelProvider: MockLanguageModelProvider;
  let mockOptimizer: MockOptimizationService;
  let mockProgress: MockProgressService;
  let mockLogger: MockLogger;

  setup(() => {
    mockModelProvider = new MockLanguageModelProvider();
    mockOptimizer = new MockOptimizationService();
    mockProgress = new MockProgressService();
    mockLogger = new MockLogger();

    strategy = new ManualModeStrategy(
      mockOptimizer,
      mockModelProvider,
      mockProgress,
      mockLogger,
    );
  });

  test("canHandle returns true for manual mode", () => {
    assert.strictEqual(strategy.canHandle("manual"), true);
    assert.strictEqual(strategy.canHandle("realtime"), false);
    assert.strictEqual(strategy.canHandle("file"), false);
  });

  test("execute does nothing if model is missing", async () => {
    const context: any = {
      documentUri: vscode.Uri.file("/test/test.prompt.md").toString(),
      originalPrompt: "Test Prompt",
      prompt: "Test Prompt",
      range: new vscode.Range(0, 0, 0, 10),
    };

    mockModelProvider.setReturnNull(true);

    await strategy.execute(context);

    // If model is null, it should NOT call optimize.
    assert.strictEqual(mockOptimizer.optimizeCalled, 0);
  });
});
