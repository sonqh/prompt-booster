/**
 * Unit tests for FileModeStrategy
 */
import * as assert from "assert";
import { FileModeStrategy } from "../../../core/strategies/FileModeStrategy";
import {
  MockLanguageModelProvider,
  MockOptimizationService,
  MockConfigurationManager,
  MockProgressService,
  MockFileSystem,
} from "../../mocks/MockServices";
import { MockLogger } from "../../mocks/MockLogger";

suite("FileModeStrategy Test Suite", () => {
  let strategy: FileModeStrategy;
  let mockModelProvider: MockLanguageModelProvider;
  let mockOptimizer: MockOptimizationService;
  let mockConfig: MockConfigurationManager;
  let mockProgress: MockProgressService;
  let mockFileSystem: MockFileSystem;
  let mockLogger: MockLogger;

  setup(() => {
    mockModelProvider = new MockLanguageModelProvider();
    mockOptimizer = new MockOptimizationService();
    mockConfig = new MockConfigurationManager();
    mockProgress = new MockProgressService();
    mockFileSystem = new MockFileSystem();
    mockLogger = new MockLogger();

    strategy = new FileModeStrategy(
      mockOptimizer,
      mockModelProvider,
      mockConfig,
      mockFileSystem,
      mockProgress,
      mockLogger,
    );
  });

  test("canHandle returns true for file mode", () => {
    assert.strictEqual(strategy.canHandle("file"), true);
    assert.strictEqual(strategy.canHandle("manual"), false);
    assert.strictEqual(strategy.canHandle("realtime"), false);
  });

  test("generatePromptFile creates file with optimized content", async () => {
    const original = "Create a login form";
    const optimized = "Optimized: Create a login form";

    // Default pattern is 'prompt'
    // 'Create a login form' -> slug 'create-a-login-form'
    // Output dir: '.github/prompts'

    const filePath = await strategy.generatePromptFile(original, optimized);

    const expectedPath =
      "/mock/workspace/.github/prompts/create-a-login-form.prompt.md";
    assert.strictEqual(filePath, expectedPath);

    // Verify file created
    const fileContent = await mockFileSystem.readFile(expectedPath);
    assert.ok(fileContent.includes(optimized));
    assert.ok(fileContent.includes("Original Prompt:"));
    assert.ok(fileContent.includes("<!--"));
  });
});
