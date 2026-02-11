/**
 * Unit tests for PromptOptimizationService
 */
/// <reference types="mocha" />
import * as assert from "assert";
import { PromptOptimizationService } from "../../core/services/PromptOptimizationService";
import { MockLogger } from "../mocks/MockLogger";

suite("PromptOptimizationService Test Suite", () => {
  let service: PromptOptimizationService;
  let mockLogger: MockLogger;

  setup(() => {
    mockLogger = new MockLogger();
    service = new PromptOptimizationService(mockLogger);
  });

  test("optimize returns enhanced prompt string", async () => {
    // Mock the model response
    const mockModel: any = {
      sendRequest: async (
        _messages: any[],
        _options: any,
        _token: any,
      ): Promise<any> => {
        return {
          text: (async function* () {
            yield JSON.stringify({
              intent: "ask",
              enhancedPrompt: "Enhanced: Test Prompt",
            });
          })(),
        };
      },
    };

    const result = await service.optimize("Test Prompt", {
      model: mockModel,
    });

    assert.strictEqual(result, "Enhanced: Test Prompt");
  });

  test("optimizeStructured returns intent and prompt", async () => {
    const mockModel: any = {
      sendRequest: async (
        _messages: any[],
        _options: any,
        _token: any,
      ): Promise<any> => {
        return {
          text: (async function* () {
            yield JSON.stringify({
              intent: "edit",
              enhancedPrompt: "Structured Edit",
            });
          })(),
        };
      },
    };

    const result = await service.optimizeStructured("Code Request", {
      model: mockModel,
    });

    assert.strictEqual(result.intent, "edit");
    assert.strictEqual(result.enhancedPrompt, "Structured Edit");
  });

  test("handles JSON parsing errors gracefully", async () => {
    const mockModel: any = {
      sendRequest: async (
        _messages: any[],
        _options: any,
        _token: any,
      ): Promise<any> => {
        return {
          text: (async function* () {
            yield "Not JSON";
          })(),
        };
      },
    };

    const result = await service.optimizeStructured("Bad JSON", {
      model: mockModel,
    });

    // Should fallback to treating the response as the prompt and intent 'ask'
    assert.strictEqual(result.intent, "ask");
    assert.strictEqual(result.enhancedPrompt, "Not JSON");
    assert.strictEqual(mockLogger.warnings.length, 1); // Should warn about parsing
  });
});
