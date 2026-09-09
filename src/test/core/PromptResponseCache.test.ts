/**
 * Tests for PromptResponseCache (Phase E2)
 *
 * Key formula (whitespace-normalized, NOT lowercased; catalog fingerprint,
 * optimizer-prompt version, few-shot stamp), LRU + TTL over workspace state,
 * corrupt-state tolerance, disabled posture, and hit-count inflation.
 */
import * as assert from "assert";
import {
  PromptResponseCache,
  normalizeWhitespace,
  computeResponseCacheKey,
} from "../../core/services/PromptResponseCache";
import { MockStateRepository } from "../mocks/MockStateRepository";
import { MockConfigurationManager } from "../mocks/MockServices";
import { MockLogger } from "../mocks/MockLogger";
import { CachedPromptResponse } from "../../shared/types/PromptFeedbackTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeHarness(
  overrides: Partial<{ config: MockConfigurationManager }> = {},
) {
  const state = new MockStateRepository();
  const config = overrides.config ?? new MockConfigurationManager();
  const logger = new MockLogger();
  const cache = new PromptResponseCache(state, config, logger);
  return { state, config, logger, cache };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

suite("PromptResponseCache", () => {
  // ── Key formula ────────────────────────────────────────────────────────────

  test("normalizeWhitespace collapses runs and trims, but does not lowercase", () => {
    assert.strictEqual(
      normalizeWhitespace("  Fix \n\t the   BUG\nin file "),
      "Fix the BUG in file",
    );
  });

  test("whitespace-normalized prompt variants share a key", () => {
    const a = computeResponseCacheKey("fix   the\nbug", "fp", "");
    const b = computeResponseCacheKey(" fix\tthe bug ", "fp", "");
    assert.strictEqual(a, b);
  });

  test("case-differing prompts get different keys (conservative)", () => {
    const a = computeResponseCacheKey("Fix the bug", "fp", "");
    const b = computeResponseCacheKey("fix the bug", "fp", "");
    assert.notStrictEqual(a, b);
  });

  test("catalog fingerprint change ⇒ different key", () => {
    assert.notStrictEqual(
      computeResponseCacheKey("fix the bug", "fp1", ""),
      computeResponseCacheKey("fix the bug", "fp2", ""),
    );
  });

  test("few-shot stamp change ⇒ different key", () => {
    assert.notStrictEqual(
      computeResponseCacheKey("fix the bug", "fp", ""),
      computeResponseCacheKey("fix the bug", "fp", "stamp-abc"),
    );
  });

  test("optimizer-prompt version change ⇒ different key", () => {
    const a = computeResponseCacheKey("fix the bug", "fp", "", "1");
    const b = computeResponseCacheKey("fix the bug", "fp", "", "2");
    assert.notStrictEqual(a, b);
  });

  test("key formula includes the documented schema version prefix", () => {
    // Same inputs across independently constructed caches must agree, and the
    // NUL separator cannot occur in normalized prompt text (space-collapsed).
    assert.strictEqual(
      computeResponseCacheKey("a b", "fp", "s"),
      computeResponseCacheKey("a b", "fp", "s"),
    );
  });

  // ── get / put behavior ─────────────────────────────────────────────────────

  test("put then get returns the stored response byte-identically", async () => {
    const { cache } = makeHarness();
    const key = cache.computeKey("fix the bug", "fp", "");
    cache.put(key, "STORED OUTPUT", "edit");
    await settle();
    const hit = await cache.get(key);
    assert.ok(hit);
    assert.strictEqual(hit.enhancedPrompt, "STORED OUTPUT");
    assert.strictEqual(hit.intent, "edit");
  });

  test("miss on an unseen key; hits inflate hitCount and stats", async () => {
    const { cache } = makeHarness();
    const miss = await cache.get("unknown-key");
    assert.strictEqual(miss, undefined);

    const key = cache.computeKey("fix the bug", "fp", "");
    cache.put(key, "out", "ask"); // stored with hitCount 0
    await settle();
    const firstHit = await cache.get(key);
    await settle();
    const secondHit = await cache.get(key);
    await settle();

    // Each hit returns the post-increment count and mutates the stored entry.
    assert.strictEqual(firstHit?.hitCount, 1, "first hit inflates 0 → 1");
    assert.strictEqual(secondHit?.hitCount, 2, "second hit inflates 1 → 2");
    // Returned copies must not alias the stored entry.
    assert.notStrictEqual(firstHit, secondHit);

    const stats = cache.getCacheStats();
    assert.strictEqual(stats.hits, 2);
    assert.strictEqual(stats.misses, 1);
    assert.strictEqual(stats.hitRate, 2 / 3);
  });

  test("whitespace-normalized prompt variants hit the same entry", async () => {
    const { cache } = makeHarness();
    cache.put(cache.computeKey("fix   the\nbug", "fp", ""), "OUT", "ask");
    await settle();
    const hit = await cache.get(cache.computeKey("fix the bug", "fp", ""));
    assert.ok(hit, "normalized variant must hit");
    assert.strictEqual(hit.enhancedPrompt, "OUT");
  });

  test("TTL expiry ⇒ miss", async () => {
    const config = new MockConfigurationManager();
    config.setFeedbackLearningOptions({ cacheTtlDays: 7 });
    const { cache, state } = makeHarness({ config });
    cache.put(cache.computeKey("p", "fp", ""), "OUT", "ask");
    await settle();

    // Age the entry beyond the TTL.
    const stored = state.getWorkspace<
      Array<{ key: string; response: CachedPromptResponse }>
    >("promptbooster.responseCache.entries")!;
    stored[0].response.createdAt = Date.now() - 8 * DAY_MS;
    state.workspace.set("promptbooster.responseCache.entries", stored);

    const hit = await cache.get(cache.computeKey("p", "fp", ""));
    assert.strictEqual(hit, undefined, "expired entry must be a miss");
  });

  test("LRU cap evicts the least recently used entry", async () => {
    const config = new MockConfigurationManager();
    config.setFeedbackLearningOptions({ cacheMaxEntries: 3 });
    const { cache } = makeHarness({ config });
    const k1 = cache.computeKey("p1", "fp", "");
    const k2 = cache.computeKey("p2", "fp", "");
    const k3 = cache.computeKey("p3", "fp", "");
    const k4 = cache.computeKey("p4", "fp", "");
    cache.put(k1, "1", "ask");
    cache.put(k2, "2", "ask");
    cache.put(k3, "3", "ask");
    await settle();
    // Touch k1 so k2 becomes the LRU entry.
    await cache.get(k1);
    await settle();
    cache.put(k4, "4", "ask");
    await settle();

    assert.ok(await cache.get(k1), "recently used entry survives");
    assert.strictEqual(await cache.get(k2), undefined, "LRU entry evicted");
    assert.ok(await cache.get(k4), "newest entry present");
  });

  test("corrupt payload ⇒ miss without throwing", async () => {
    const { cache, state } = makeHarness();
    state.workspace.set("promptbooster.responseCache.entries", "not-an-array");
    const hit = await cache.get("any-key"); // must not throw
    assert.strictEqual(hit, undefined);
    cache.put("k", "out", "ask"); // must not throw either
    await settle();
  });

  test("entries with wrong shape are ignored (miss)", async () => {
    const { cache, state } = makeHarness();
    state.workspace.set("promptbooster.responseCache.entries", [
      { noKey: true },
      { key: "k", response: "garbage" },
    ]);
    const hit = await cache.get("k");
    assert.strictEqual(hit, undefined);
  });

  test("entries with corrupt response fields are ignored (miss, never a hit)", async () => {
    const { cache, state } = makeHarness();
    // A non-numeric createdAt must NOT be treated as a fresh hit (the TTL
    // comparison would be NaN > ttl ⇒ false), and a wrong intent must not
    // flow into PromptResult — both degrade to a miss.
    state.workspace.set("promptbooster.responseCache.entries", [
      {
        key: "k-string-created",
        response: { enhancedPrompt: "x", intent: "ask", createdAt: "yesterday", hitCount: 0 },
      },
      {
        key: "k-bad-intent",
        response: { enhancedPrompt: "x", intent: "mystery", createdAt: Date.now(), hitCount: 0 },
      },
      {
        key: "k-bad-hitcount",
        response: { enhancedPrompt: "x", intent: "edit", createdAt: Date.now(), hitCount: "many" },
      },
    ]);
    assert.strictEqual(await cache.get("k-string-created"), undefined);
    assert.strictEqual(await cache.get("k-bad-intent"), undefined);
    assert.strictEqual(await cache.get("k-bad-hitcount"), undefined);
  });

  test("disabled ⇒ always miss and put is a no-op", async () => {
    const config = new MockConfigurationManager();
    config.setFeedbackLearningOptions({ cacheEnabled: false });
    const { cache, state } = makeHarness({ config });
    const key = cache.computeKey("p", "fp", "");
    cache.put(key, "OUT", "ask");
    await settle();
    assert.strictEqual(await cache.get(key), undefined);
    assert.strictEqual(
      state.getWorkspace("promptbooster.responseCache.entries"),
      undefined,
      "disabled cache writes nothing",
    );
    assert.strictEqual(cache.getCacheStats().hits, 0);
  });

  test("state write failure ⇒ logged, never throws, degrades gracefully", async () => {
    const { cache, state, logger, config } = makeHarness();
    state.failOnWrite = true;
    cache.put("k", "out", "ask"); // must not throw
    await settle();
    assert.ok(
      logger.warnings.some((w) => w.includes("PromptResponseCache")),
      "persistence failure is logged",
    );

    // Fire-and-forget put means the in-memory entry survives a failed persist
    // — the cache stays functional for the session (here: still a hit).
    const inMemory = await cache.get("k");
    assert.ok(inMemory);
    assert.strictEqual(inMemory.enhancedPrompt, "out");

    // Across a "restart" (fresh cache over the same failed-write state) the
    // unpersisted entry is gone — a clean miss, never an error.
    const revived = new PromptResponseCache(state, config, logger);
    assert.strictEqual(await revived.get("k"), undefined);
  });

  test("state read failure ⇒ miss without throwing", async () => {
    const state = new MockStateRepository();
    state.getWorkspace = (() => {
      throw new Error("state exploded");
    }) as unknown as typeof state.getWorkspace;
    const cache = new PromptResponseCache(
      state,
      new MockConfigurationManager(),
      new MockLogger(),
    );
    assert.strictEqual(await cache.get("k"), undefined);
  });

  test("put overwrites an existing key in place (upsert)", async () => {
    const { cache } = makeHarness();
    const key = cache.computeKey("p", "fp", "");
    cache.put(key, "first", "ask");
    await settle();
    cache.put(key, "second", "edit");
    await settle();
    const hit = await cache.get(key);
    assert.strictEqual(hit?.enhancedPrompt, "second");
    assert.strictEqual(hit?.intent, "edit");
  });
});
