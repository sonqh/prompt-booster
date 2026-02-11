/**
 * Unit tests for RealtimeModeStrategy
 */
import * as assert from "assert";
import * as vscode from "vscode";
import { RealtimeModeStrategy } from "../../../core/strategies/RealtimeModeStrategy";
import {
  MockLanguageModelProvider,
  MockOptimizationService,
  MockConfigurationManager,
} from "../../mocks/MockServices";
import { MockLogger } from "../../mocks/MockLogger";

suite("RealtimeModeStrategy Test Suite", () => {
  let strategy: RealtimeModeStrategy;
  let mockModelProvider: MockLanguageModelProvider;
  let mockOptimizer: MockOptimizationService;
  let mockConfig: MockConfigurationManager;
  let mockLogger: MockLogger;

  setup(() => {
    mockModelProvider = new MockLanguageModelProvider();
    mockOptimizer = new MockOptimizationService();
    mockConfig = new MockConfigurationManager();
    mockLogger = new MockLogger();

    strategy = new RealtimeModeStrategy(
      mockOptimizer,
      mockModelProvider,
      mockConfig,
      mockLogger,
    );
  });

  test("canHandle returns true for realtime mode", () => {
    assert.strictEqual(strategy.canHandle("realtime"), true);
    assert.strictEqual(strategy.canHandle("manual"), false);
    assert.strictEqual(strategy.canHandle("file"), false);
  });

  test("execute warns if auto-optimization is disabled", async () => {
    mockConfig.setAutoOptimize(false);

    const mockStream = {
      output: "",
      markdown: function (value: string) {
        this.output += value;
      },
      button: function (_: any) {},
      progress: function (_: string) {},
    };

    const context: any = {
      metadata: {
        stream: mockStream,
        request: { prompt: "Test", command: "", references: [], toolCalls: [] },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.ok(mockStream.output.includes("Auto-optimization is disabled"));
    assert.strictEqual(mockOptimizer.optimizeStructuredCalled, 0);
  });

  test("execute proceeds when auto-optimization is enabled and permission granted", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);

    const mockStream = {
      output: [] as string[],
      buttons: [] as any[],
      markdown: function (value: string) {
        this.output.push(value);
      },
      button: function (btn: any) {
        this.buttons.push(btn);
      },
      progress: function (_: string) {},
    };

    const context: any = {
      metadata: {
        stream: mockStream,
        request: {
          prompt: "Test Code",
          command: "",
          references: [],
          toolCalls: [],
        },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.strictEqual(mockOptimizer.optimizeStructuredCalled, 1);
    // It should output "Optimized Prompt" header and the result
    assert.ok(
      mockStream.output.some((s: string) => s.includes("Optimized Prompt")),
    );
    // It should have buttons
    assert.ok(mockStream.buttons.length > 0);
  });

  test("execute handles missing model gracefully", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);
    mockModelProvider.setReturnNull(true);

    const mockStream = {
      output: "",
      markdown: function (value: string) {
        this.output += value;
      },
      button: function (_: any) {},
      progress: function (_: string) {},
    };

    const context: any = {
      metadata: {
        stream: mockStream,
        request: { prompt: "Test", command: "", references: [], toolCalls: [] },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.ok(mockStream.output.includes("No language model available"));
    assert.strictEqual(mockOptimizer.optimizeStructuredCalled, 0);
  });
});
