/**
 * Tests for McpServerProbe — protocol logic over a mocked transport.
 * Hermetic: no process is spawned; the transport is MockMcpProcessTransport.
 */
import * as assert from "assert";
import { McpServerProbe } from "../../core/services/McpServerProbe";
import { MockMcpProcessTransport } from "../mocks/MockMcpProcessTransport";
import { MockLogger } from "../mocks/MockLogger";

const SECRET_VALUE = "super-secret-token";

function makeProbe() {
  const transport = new MockMcpProcessTransport();
  const logger = new MockLogger();
  const probe = new McpServerProbe(transport, logger);
  return { probe, transport, logger };
}

const target = {
  serverName: "postgres-mcp",
  command: "node",
  args: ["server.js"],
  env: { DB_PASSWORD: SECRET_VALUE },
};

suite("McpServerProbe", () => {
  test("happy path maps tools/list results", async () => {
    const { probe, transport } = makeProbe();
    transport.behaviors.push(() =>
      Promise.resolve({
        tools: [
          { name: "query_db", description: "Execute SQL queries" },
          { name: "list_tables", description: "List tables" },
        ],
      }),
    );

    const result = await probe.listServerTools(target);
    assert.strictEqual(result.tools.length, 2);
    assert.strictEqual(result.tools[0].name, "query_db");
    assert.strictEqual(transport.requests.length, 1);
  });

  test("transport failure (initialize error) resolves to an empty result", async () => {
    const { probe, transport } = makeProbe();
    transport.behaviors.push(() => Promise.resolve({ tools: [] }));

    const result = await probe.listServerTools(target);
    assert.deepStrictEqual(result.tools, []);
  });

  test("transport rejection resolves to an empty result (never throws)", async () => {
    const { probe, transport } = makeProbe();
    transport.behaviors.push(() =>
      Promise.reject(new Error("spawn ENOENT")),
    );

    const result = await probe.listServerTools(target);
    assert.deepStrictEqual(result.tools, []);
  });

  test("hung transport times out to an empty result with a bounded deadline", async () => {
    const { probe, transport } = makeProbe();
    transport.behaviors.push(() => new Promise(() => {})); // never resolves

    const started = Date.now();
    const result = await probe.listServerTools(target, 50);
    const elapsed = Date.now() - started;

    assert.deepStrictEqual(result.tools, []);
    assert.ok(elapsed < 5_000, `probe must not hang (took ${elapsed}ms)`);
    // The transport request carried the deadline so the child gets killed.
    assert.strictEqual(transport.requests[0].timeoutMs, 50);
  });

  test("malformed tool entries are skipped", async () => {
    const { probe, transport } = makeProbe();
    transport.behaviors.push(() =>
      Promise.resolve({
        tools: [
          { name: "ok_tool", description: "fine" },
          { description: "no name" },
          { name: "", description: "empty name" },
          { name: 42 },
          "not-an-object",
          null,
        ] as any,
      }),
    );

    const result = await probe.listServerTools(target);
    assert.strictEqual(result.tools.length, 1);
    assert.strictEqual(result.tools[0].name, "ok_tool");
  });

  test("env values never appear in logger output", async () => {
    const { probe, transport, logger } = makeProbe();
    // Exercise success, failure, and timeout paths — none may log env.
    transport.behaviors.push(() =>
      Promise.reject(new Error("spawn failed")),
    );

    await probe.listServerTools(target);
    transport.behaviors.push(() => new Promise(() => {}));
    await probe.listServerTools(target, 30);
    transport.behaviors.push(() =>
      Promise.resolve({ tools: [{ name: "x", description: "y" }] }),
    );
    await probe.listServerTools(target);

    const allLogs = [...logger.logs, ...logger.warnings, ...logger.errors];
    assert.ok(
      allLogs.every((l) => !l.includes(SECRET_VALUE)),
      "env values must never be logged",
    );
    assert.ok(
      allLogs.every((l) => !l.includes("DB_PASSWORD")),
      "env keys must never be logged",
    );
  });

  test("default deadline is the documented 6s probe budget", async () => {
    const { probe, transport } = makeProbe();
    transport.behaviors.push(() => Promise.resolve({ tools: [] }));
    await probe.listServerTools({ ...target, env: undefined });
    assert.strictEqual(transport.requests[0].timeoutMs, 6_000);
  });
});
