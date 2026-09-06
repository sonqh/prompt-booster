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
  MockFileSystem,
  MockMCPToolRegistry,
} from "../../mocks/MockServices";
import { MockLogger } from "../../mocks/MockLogger";
import { WorkspaceContextGatherer } from "../../../core/services/WorkspaceContextGatherer";
import { ReferenceResolver } from "../../../core/services/ReferenceResolver";
import { classifyTools } from "../../../core/services/ToolAffinityClassifier";

suite("RealtimeModeStrategy Test Suite", () => {
  let strategy: RealtimeModeStrategy;
  let mockModelProvider: MockLanguageModelProvider;
  let mockOptimizer: MockOptimizationService;
  let mockConfig: MockConfigurationManager;
  let mockFileSystem: MockFileSystem;
  let mockLogger: MockLogger;
  let mockMcpRegistry: MockMCPToolRegistry;
  let contextGatherer: WorkspaceContextGatherer;
  let referenceResolver: ReferenceResolver;

  setup(() => {
    mockModelProvider = new MockLanguageModelProvider();
    mockOptimizer = new MockOptimizationService();
    mockConfig = new MockConfigurationManager();
    mockFileSystem = new MockFileSystem();
    mockLogger = new MockLogger();
    mockMcpRegistry = new MockMCPToolRegistry();

    contextGatherer = new WorkspaceContextGatherer(mockLogger);
    referenceResolver = new ReferenceResolver(mockFileSystem, mockLogger);

    strategy = new RealtimeModeStrategy(
      mockOptimizer,
      mockModelProvider,
      mockConfig,
      mockLogger,
      contextGatherer,
      referenceResolver,
      mockMcpRegistry as any,
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

  test("execute resolves file references", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);

    // Setup mock file
    const fileUri = vscode.Uri.file("/workspace/test.ts");
    await mockFileSystem.writeFile(fileUri, "console.log('test')");

    const mockStream = {
      output: [] as string[],
      markdown: function (value: string) {
        this.output.push(value);
      },
      button: function (_: any) {},
      progress: function (_: string) {},
    };

    const context: any = {
      metadata: {
        stream: mockStream,
        request: {
          prompt: "Optimize this",
          command: "",
          references: [{ value: fileUri }],
          toolCalls: [],
        },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    // Spy on optimizeStructured to check the passed prompt
    let capturedPrompt = "";
    const originalOptimize =
      mockOptimizer.optimizeStructured.bind(mockOptimizer);
    mockOptimizer.optimizeStructured = async (prompt, options) => {
      capturedPrompt = prompt;
      return originalOptimize(prompt, options);
    };

    await strategy.execute(context);

    // Verify file content was included in the prompt
    // ReferenceResolver formats as "### Reference: `<path>`" blocks
    assert.ok(
      capturedPrompt.includes("console.log('test')"),
      "file content should be included in prompt",
    );
  });

  test("uses cached registry via ensureCatalog (not per-request discover)", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);

    const mockStream = {
      output: [] as string[],
      markdown: function (value: string) {
        this.output.push(value);
      },
      button: function (_: any) {},
      progress: function (_: string) {},
    };

    const context: any = {
      metadata: {
        stream: mockStream,
        request: {
          prompt: "Summarize the authentication flow",
          command: "",
          references: [],
          toolCalls: [],
        },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.strictEqual(mockMcpRegistry.ensureCatalogCalled, 1);
  });

  test("empty MCP catalog ⇒ optimizer prompt identical to Enhancements 1–3 only", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);
    // mockMcpRegistry starts with an empty catalog — nothing resolvable.

    const prompt = "Summarize the authentication flow";

    let capturedPrompt = "";
    const originalOptimize =
      mockOptimizer.optimizeStructured.bind(mockOptimizer);
    mockOptimizer.optimizeStructured = async (promptText, options) => {
      capturedPrompt = promptText;
      return originalOptimize(promptText, options);
    };

    const mockStream = {
      output: [] as string[],
      markdown: function (value: string) {
        this.output.push(value);
      },
      button: function (_: any) {},
      progress: function (_: string) {},
    };
    const context: any = {
      metadata: {
        stream: mockStream,
        request: {
          prompt,
          command: "",
          references: [],
          toolCalls: [],
        },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    // Reconstruct the Enhancements 1–3 assembly with the same collaborators
    // and assert byte-identity: with a zero-tool catalog, Enhancement 4 must
    // contribute nothing at all.
    const wsCtx = await contextGatherer.gather();
    const preamble = contextGatherer.formatAsPromptPreamble(wsCtx);
    const { cleanPrompt } = await referenceResolver.resolveInlineTokens(prompt);
    const { toolAnnotations } = classifyTools(cleanPrompt, []);

    const parts: string[] = [];
    if (preamble) parts.push(preamble);
    parts.push(
      `### User Request\n${cleanPrompt}${
        toolAnnotations ? "\n\n" + toolAnnotations : ""
      }`,
    );
    const expected = parts.join("\n\n");

    assert.strictEqual(capturedPrompt, expected);
    assert.ok(
      !capturedPrompt.includes("Available MCP Tools"),
      "no MCP catalog block may appear with an empty catalog",
    );
  });
});
