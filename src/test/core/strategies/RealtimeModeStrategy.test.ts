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
  MockPromptFeedbackLog,
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
  let mockFeedbackLog: MockPromptFeedbackLog;
  let contextGatherer: WorkspaceContextGatherer;
  let referenceResolver: ReferenceResolver;

  setup(() => {
    mockModelProvider = new MockLanguageModelProvider();
    mockOptimizer = new MockOptimizationService();
    mockConfig = new MockConfigurationManager();
    mockFileSystem = new MockFileSystem();
    mockLogger = new MockLogger();
    mockMcpRegistry = new MockMCPToolRegistry();
    mockFeedbackLog = new MockPromptFeedbackLog();

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
      mockFeedbackLog as any,
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

  test("foreign-only catalog ⇒ no MCP block and no MCP tags (default)", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);
    mockMcpRegistry.setMockCatalog([
      {
        serverName: "cursor-server",
        toolName: "query_db",
        qualifiedName: "cursor-server.query_db",
        description: "Execute SQL queries against the project database",
        enabled: true,
        source: "cursor",
        sources: ["cursor"],
        visibility: "foreign",
        origin: "inline-schema",
      },
    ]);

    const prompt = "profile the slow query on the project database";

    let capturedPrompt = "";
    const originalOptimize =
      mockOptimizer.optimizeStructured.bind(mockOptimizer);
    mockOptimizer.optimizeStructured = async (promptText, options) => {
      capturedPrompt = promptText;
      return originalOptimize(promptText, options);
    };

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
        request: { prompt, command: "", references: [], toolCalls: [] },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.ok(
      !capturedPrompt.includes("Available MCP Tools"),
      "foreign tools must not be injected by default (F2)",
    );
    assert.ok(
      !mockStream.output.some((s: string) => s.includes("MCP Tools")),
      "no MCP tool tags may render for a foreign-only catalog",
    );
  });

  test("includeForeignServers opt-in ⇒ foreign tool injected and annotated", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);
    mockConfig.setMcpProvisioningOptions({ includeForeignServers: true });
    mockMcpRegistry.setMockCatalog([
      {
        serverName: "cursor-server",
        toolName: "query_db",
        qualifiedName: "cursor-server.query_db",
        description: "Execute SQL queries against the project database",
        enabled: true,
        source: "cursor",
        sources: ["cursor"],
        visibility: "foreign",
        origin: "inline-schema",
      },
    ]);

    const prompt = "profile the slow query on the project database";

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
        request: { prompt, command: "", references: [], toolCalls: [] },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.ok(
      capturedPrompt.includes("cursor-server.query_db"),
      "opt-in foreign tool is injected into the optimizer prompt",
    );
    assert.ok(
      capturedPrompt.includes("other-editor tool"),
      "foreign tool carries the only-use-if-available annotation",
    );
    assert.ok(
      mockStream.output.some((s: string) => s.includes("(other-editor)")),
      "rendered MCP tags are source-annotated",
    );
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

  // ── Phase E1: feedback capture at render time ─────────────────────────────

  test("creates a pending feedback record and threads [text, feedbackId, outcome] into buttons", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);
    mockMcpRegistry.setMockCatalog([
      {
        serverName: "db-mcp",
        toolName: "query",
        qualifiedName: "db-mcp.query",
        description: "Execute SQL queries against the project database",
        enabled: true,
        source: "vscode-workspace",
        sources: ["vscode-workspace"],
        visibility: "injectable",
        origin: "inline-schema",
      },
    ]);

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
          prompt: "profile the slow query on the project database",
          command: "",
          references: [],
          toolCalls: [],
        },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    // Pending record carries the raw prompt, the enhanced text, the intent,
    // the injected tool names, and the catalog fingerprint.
    assert.strictEqual(mockFeedbackLog.createPendingCalls.length, 1);
    const input: any = mockFeedbackLog.createPendingCalls[0];
    assert.strictEqual(input.rawPrompt, "profile the slow query on the project database");
    assert.ok(typeof input.enhancedPrompt === "string");
    assert.strictEqual(input.intent, "ask");
    assert.deepStrictEqual(input.mcpRefs, ["db-mcp.query"]);
    assert.deepStrictEqual(input.catalogFingerprint, "mock-fingerprint");

    // Buttons carry the id: apply = [text, id, "accept"], original =
    // [text, id, "reject"], refine = [original, optimized, id].
    const feedbackId = "feedback-1";
    const runPromptButtons = mockStream.buttons.filter(
      (b: any) => b.command === "promptBooster.runPrompt",
    );
    assert.ok(
      runPromptButtons.some(
        (b: any) =>
          b.arguments.length === 3 &&
          b.arguments[1] === feedbackId &&
          b.arguments[2] === "accept",
      ),
      "accept button carries [text, feedbackId, 'accept']",
    );
    assert.ok(
      runPromptButtons.some(
        (b: any) =>
          b.arguments.length === 3 &&
          b.arguments[1] === feedbackId &&
          b.arguments[2] === "reject",
      ),
      "reject (Use Original) button carries [original, feedbackId, 'reject']",
    );
    assert.ok(
      mockStream.buttons.some(
        (b: any) =>
          b.command === "promptBooster.createPromptFile" &&
          b.arguments.length === 3 &&
          b.arguments[2] === feedbackId,
      ),
      "refine button carries [original, optimized, feedbackId]",
    );
  });

  test("attaches best-effort feature-detected request.toolCalls to the record", async () => {
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
          prompt: "run the tests",
          command: "",
          references: [],
          toolCalls: [{ name: "mcp_db_query" }],
        },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    const input: any = mockFeedbackLog.createPendingCalls[0];
    assert.deepStrictEqual(input.observedToolCalls, ["mcp_db_query"]);
  });

  test("throwing feedback log ⇒ enhance still renders (fire-and-forget)", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);
    mockFeedbackLog.failCreate = true;

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
        request: { prompt: "Test", command: "", references: [], toolCalls: [] },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.strictEqual(mockOptimizer.optimizeStructuredCalled, 1);
    assert.ok(
      mockStream.output.some((s: string) => s.includes("Optimized Prompt")),
      "the enhance must still render when feedback capture throws",
    );
    assert.ok(mockStream.buttons.length > 0, "buttons still render");
    // Buttons fall back to the plain argument shapes (no feedbackId).
    assert.ok(
      mockStream.buttons
        .filter((b: any) => b.command === "promptBooster.runPrompt")
        .every((b: any) => b.arguments.length === 1),
      "no feedbackId in button args when capture failed",
    );
  });

  test("feedback disabled ⇒ no pending record and plain button arguments", async () => {
    mockConfig.setAutoOptimize(true);
    mockConfig.setPermission(true);
    mockConfig.setFeedbackLearningOptions({ feedbackEnabled: false });

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
        request: { prompt: "Test", command: "", references: [], toolCalls: [] },
        token: new vscode.CancellationTokenSource().token,
      },
    };

    await strategy.execute(context);

    assert.strictEqual(mockFeedbackLog.createPendingCalls.length, 0);
    assert.ok(
      mockStream.buttons.every((b: any) => b.arguments.length <= 2),
      "no [text, feedbackId, outcome] triples when capture is disabled",
    );
  });
});
