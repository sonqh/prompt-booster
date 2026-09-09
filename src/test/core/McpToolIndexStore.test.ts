/**
 * Tests for McpToolIndexStore — manual index file I/O (defensive parsing)
 * and the probe cache (command+args fingerprint, 24h TTL, corruption
 * tolerance). Hermetic: MockFileSystem + MockStateRepository.
 */
import * as assert from "assert";
import {
  McpToolIndexStore,
  PROBE_CACHE_STATE_KEY,
  probeCacheFingerprint,
} from "../../core/services/McpToolIndexStore";
import { MockFileSystem } from "../mocks/MockServices";
import { MockStateRepository } from "../mocks/MockStateRepository";
import { MockLogger } from "../mocks/MockLogger";

const INDEX_PATH = "/mock/workspace/.vscode/promptbooster-mcp-tools.json";

function makeStore() {
  const fs = new MockFileSystem();
  const state = new MockStateRepository();
  const logger = new MockLogger();
  const store = new McpToolIndexStore(fs, state, logger);
  /** Inject a file with coherent stat info (MockFileSystem convention). */
  const setFile = (path: string, content: string): void => {
    fs.files.set(path, content);
    fs.stats.set(path, { mtimeMs: 1_000, size: content.length });
  };
  return { store, fs, state, logger, setFile };
}

const HOUR = 60 * 60 * 1000;

suite("McpToolIndexStore", () => {
  // ── Manual index file ──────────────────────────────────────────────────────

  test("manual index round-trips", async () => {
    const { store } = makeStore();
    const entries = [
      {
        server: "postgres-mcp",
        name: "query_db",
        description: "Execute SQL queries",
        inputSummary: "params: sql",
      },
      { server: "fs-mcp", name: "read_file", description: "Read a file" },
    ];
    await store.saveManualIndex(entries);
    const loaded = await store.loadManualIndex();
    assert.deepStrictEqual(loaded, entries);
  });

  test("malformed manual index JSON is ignored with a warning", async () => {
    const { store, setFile, logger } = makeStore();
    setFile(INDEX_PATH, "{ definitely not json");
    const loaded = await store.loadManualIndex();
    assert.deepStrictEqual(loaded, []);
    assert.ok(
      logger.warnings.some((w) => w.includes("promptbooster-mcp-tools")),
      "malformed index should warn",
    );
  });

  test("wrong-shaped manual index entries are filtered defensively", async () => {
    const { store, setFile } = makeStore();
    setFile(
      INDEX_PATH,
      JSON.stringify({
        tools: [
          { server: "ok-mcp", name: "ok_tool", description: "fine" },
          { name: "missing_server" },
          { server: "missing_name" },
          "not an object",
          42,
        ],
      }),
    );
    const loaded = await store.loadManualIndex();
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].name, "ok_tool");
  });

  test("absent manual index resolves to an empty list (no warning)", async () => {
    const { store, logger } = makeStore();
    const loaded = await store.loadManualIndex();
    assert.deepStrictEqual(loaded, []);
    assert.deepStrictEqual(logger.warnings, []);
  });

  // ── Probe cache ────────────────────────────────────────────────────────────

  test("probe cache hits for the same command+args", async () => {
    const { store } = makeStore();
    await store.setProbeCache("node", ["a.js"], [
      { name: "t1", description: "one" },
    ]);
    const hit = await store.getProbeCache("node", ["a.js"]);
    assert.ok(hit, "expected a cache hit");
    assert.strictEqual(hit.length, 1);
    assert.strictEqual(hit[0].name, "t1");
  });

  test("probe cache fingerprint mismatch is a miss", async () => {
    const { store } = makeStore();
    await store.setProbeCache("node", ["a.js"], [{ name: "t1" }]);
    assert.strictEqual(
      await store.getProbeCache("node", ["b.js"]),
      undefined,
      "different args must miss",
    );
    assert.strictEqual(
      await store.getProbeCache("python", ["a.js"]),
      undefined,
      "different command must miss",
    );
    assert.strictEqual(
      await store.getProbeCache("node"),
      undefined,
      "missing args must miss",
    );
  });

  test("probe cache TTL expiry (24h) is a miss", async () => {
    const { store, state } = makeStore();
    const fingerprint = probeCacheFingerprint("node", ["a.js"]);
    state.workspace.set(PROBE_CACHE_STATE_KEY, {
      [fingerprint]: {
        tools: [{ name: "stale" }],
        cachedAt: Date.now() - 25 * HOUR,
      },
    });
    assert.strictEqual(await store.getProbeCache("node", ["a.js"]), undefined);
  });

  test("corrupt probe-cache state degrades to empty (no throw)", async () => {
    const { store, state } = makeStore();
    state.workspace.set(PROBE_CACHE_STATE_KEY, "garbage-not-an-object");
    assert.strictEqual(await store.getProbeCache("node", ["a.js"]), undefined);
    // And writing still works afterwards
    await store.setProbeCache("node", ["a.js"], [{ name: "ok" }]);
    const hit = await store.getProbeCache("node", ["a.js"]);
    assert.ok(hit && hit[0].name === "ok");
  });

  test("state write failures are logged, not thrown", async () => {
    const { store, state, logger } = makeStore();
    state.failOnWrite = true;
    await store.setProbeCache("node", ["a.js"], [{ name: "t" }]); // must not throw
    assert.ok(
      logger.errors.some((e) => e.includes("probe cache")),
      "write failure should be logged",
    );
    assert.strictEqual(await store.getProbeCache("node", ["a.js"]), undefined);
  });
});
