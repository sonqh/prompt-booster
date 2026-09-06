/**
 * Tests for MCPToolRegistry (Enhancement 4 v2) — HERMETIC.
 *
 * All environment facts come from MockMcpEnvironmentProvider (workspace
 * folder /mock/workspace, home /mock/home — never the real VS Code workspace
 * or the developer's home directory) and MockFileSystem. The config-change
 * watcher is MockConfigChangeWatcher so invalidation is driven explicitly.
 */
import * as assert from "assert";
import { MCPToolRegistry } from "../../core/services/MCPToolRegistry";
import { MockFileSystem } from "../mocks/MockServices";
import { MockConfigurationManager } from "../mocks/MockServices";
import { MockLogger } from "../mocks/MockLogger";
import { MockMcpEnvironmentProvider } from "../mocks/MockMcpEnvironmentProvider";
import { MockConfigChangeWatcher } from "../mocks/MockConfigChangeWatcher";
import { MockRuntimeToolsProvider } from "../mocks/MockRuntimeToolsProvider";
import { MockMcpToolIndexStore } from "../mocks/MockMcpToolIndexStore";

const MB = 1024 * 1024;

/** JSON for a minimal mcp config with named servers (+ optional tool schemas). */
function mcpJson(
  servers: Record<
    string,
    {
      command?: string;
      args?: string[];
      tools?: { name: string; description?: string }[];
      disabled?: boolean;
    }
  >,
): string {
  return JSON.stringify({ servers });
}

interface RegistryHarness {
  registry: MCPToolRegistry;
  fs: MockFileSystem;
  env: MockMcpEnvironmentProvider;
  watcher: MockConfigChangeWatcher;
  config: MockConfigurationManager;
  logger: MockLogger;
  runtime: MockRuntimeToolsProvider;
  indexStore: MockMcpToolIndexStore;
}

/** Build a hermetic registry over mock files + scripted runtime/index sources. */
function makeRegistry(
  files: Record<string, string>,
  overrides: Partial<{
    env: MockMcpEnvironmentProvider;
    config: MockConfigurationManager;
    runtime: MockRuntimeToolsProvider;
    indexStore: MockMcpToolIndexStore;
  }> = {},
): RegistryHarness {
  const fs = new MockFileSystem();
  for (const [k, v] of Object.entries(files)) {
    fs.files.set(k, v);
    fs.stats.set(k, { mtimeMs: 1_000, size: v.length });
  }
  const env = overrides.env ?? new MockMcpEnvironmentProvider();
  const config = overrides.config ?? new MockConfigurationManager();
  const runtime = overrides.runtime ?? new MockRuntimeToolsProvider();
  const indexStore = overrides.indexStore ?? new MockMcpToolIndexStore();
  const watcher = new MockConfigChangeWatcher();
  const logger = new MockLogger();
  const registry = new MCPToolRegistry(
    fs,
    logger,
    env,
    runtime,
    indexStore,
    watcher,
    config,
  );
  return { registry, fs, env, watcher, config, logger, runtime, indexStore };
}

/** Let background (stale-while-revalidate) refresh promises settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

suite("MCPToolRegistry (hermetic)", () => {
  // ── Basic discovery + tagging ──────────────────────────────────────────────

  test("discovers inline tools from .vscode/mcp.json with source/visibility/origin tags", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "postgres-mcp": {
          command: "node",
          tools: [
            { name: "query_db", description: "Execute SQL queries" },
            { name: "list_tables", description: "List database tables" },
          ],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    assert.strictEqual(catalog.length, 2);
    const tool = catalog.find((t) => t.qualifiedName === "postgres-mcp.query_db");
    assert.ok(tool, "should have postgres-mcp.query_db");
    assert.strictEqual(tool.source, "vscode-workspace");
    assert.deepStrictEqual(tool.sources, ["vscode-workspace"]);
    assert.strictEqual(tool.visibility, "injectable");
    assert.strictEqual(tool.origin, "inline-schema");
    assert.strictEqual(tool.enabled, true);
  });

  test("falls back to .cline/mcp.json when .vscode/mcp.json is absent", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.cline/mcp.json": mcpJson({
        "cline-server": {
          command: "node",
          tools: [{ name: "read_file", description: "Read a file" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    const tool = catalog.find((t) => t.qualifiedName === "cline-server.read_file");
    assert.ok(tool, "should fall back to Cline config");
    assert.strictEqual(tool.source, "cline");
  });

  test("falls back to .github/copilot/mcp.json when .vscode/mcp.json is absent", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.github/copilot/mcp.json": mcpJson({
        "copilot-server": {
          command: "node",
          tools: [{ name: "search", description: "Search codebase" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    assert.ok(
      catalog.some((t) => t.qualifiedName === "copilot-server.search"),
      "should fall back to GitHub Copilot config",
    );
  });

  test("discovers servers from VS Code settings (mcp.servers)", async () => {
    const env = new MockMcpEnvironmentProvider();
    env.vsCodeServerSettings = {
      "settings-server": {
        command: "node",
        tools: [{ name: "settings_tool", description: "From settings" }],
      },
    };
    const { registry } = makeRegistry({}, { env });
    const catalog = await registry.ensureCatalog();
    const tool = catalog.find(
      (t) => t.qualifiedName === "settings-server.settings_tool",
    );
    assert.ok(tool, "should discover from mcp.servers settings");
    assert.strictEqual(tool.source, "vscode-settings");
  });

  test("discovers Claude Desktop config from the (mock) home dir", async () => {
    const { registry } = makeRegistry({
      "/mock/home/.claude/claude_desktop_config.json": JSON.stringify({
        mcpServers: {
          "desktop-server": {
            command: "node",
            tools: [{ name: "desktop_tool", description: "From Claude Desktop" }],
          },
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    const tool = catalog.find(
      (t) => t.qualifiedName === "desktop-server.desktop_tool",
    );
    assert.ok(tool, "should discover Claude Desktop config");
    assert.strictEqual(tool.source, "claude-desktop");
    assert.strictEqual(tool.visibility, "foreign");
  });

  test("returns empty catalog gracefully when no config sources exist", async () => {
    const { registry } = makeRegistry({});
    const catalog = await registry.ensureCatalog(); // must not throw
    assert.deepStrictEqual(catalog, []);
    assert.deepStrictEqual(registry.getServerNames(), []);
    assert.deepStrictEqual(registry.getInjectableCatalog(), []);
  });

  // ── Visibility policy ──────────────────────────────────────────────────────

  test("foreign-source tools are excluded from getInjectableCatalog()", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "vscode-server": {
          command: "node",
          tools: [{ name: "vs_tool", description: "Injectable" }],
        },
      }),
      "/mock/workspace/.cursor/mcp.json": mcpJson({
        "cursor-server": {
          command: "node",
          tools: [{ name: "cursor_tool", description: "Foreign" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    assert.strictEqual(catalog.length, 2, "both tools in full catalog");
    const injectable = registry.getInjectableCatalog();
    assert.ok(
      injectable.some((t) => t.qualifiedName === "vscode-server.vs_tool"),
      "vscode-workspace tool is injectable",
    );
    assert.ok(
      !injectable.some((t) => t.qualifiedName === "cursor-server.cursor_tool"),
      "cursor (foreign) tool is not injectable",
    );
  });

  // ── Deduplication + conflict detection ─────────────────────────────────────

  test("deduplicates servers across sources (first source wins)", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "my-server": {
          command: "node",
          tools: [{ name: "from_vscode", description: "From VS Code config" }],
        },
      }),
      "/mock/workspace/.cline/mcp.json": mcpJson({
        "my-server": {
          command: "node",
          tools: [{ name: "from_cline", description: "From Cline config" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    assert.ok(
      catalog.some((t) => t.toolName === "from_vscode"),
      "first source (vscode) should win",
    );
    assert.ok(
      !catalog.some((t) => t.toolName === "from_cline"),
      "duplicate server from Cline should be ignored",
    );
    const winner = catalog.find((t) => t.serverName === "my-server");
    assert.ok(winner, "winning descriptor exists");
    assert.deepStrictEqual(
      winner.sources,
      ["vscode-workspace", "cline"],
      "all advertising sources are recorded",
    );
  });

  test("warns when colliding servers declare different commands", async () => {
    const { registry, logger } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "conflicted": { command: "node", args: ["a.js"] },
      }),
      "/mock/workspace/.cursor/mcp.json": mcpJson({
        "conflicted": { command: "python", args: ["b.py"] },
      }),
    });
    await registry.ensureCatalog();
    assert.ok(
      logger.warnings.some((w) => w.includes('"conflicted"') && w.includes("different")),
      "conflicting command+args should produce a warning",
    );
  });

  test("no conflict warning when commands match across sources", async () => {
    const { registry, logger } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "aligned": { command: "node", args: ["server.js"] },
      }),
      "/mock/workspace/.cursor/mcp.json": mcpJson({
        "aligned": { command: "node ", args: ["server.js"] },
      }),
    });
    await registry.ensureCatalog();
    assert.deepStrictEqual(
      logger.warnings.filter((w) => w.includes("different")),
      [],
      "same normalized command+args must not warn",
    );
  });

  // ── Enablement checks ──────────────────────────────────────────────────────

  test("server with empty command is skipped (not in catalog)", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "broken-server": {
          command: "",
          tools: [{ name: "broken_tool", description: "A broken tool" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    assert.ok(
      !catalog.some((t) => t.serverName === "broken-server"),
      "server with empty command should be excluded",
    );
  });

  test("server with disabled:true is excluded from getToolCatalog()", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "disabled-server": {
          command: "node",
          disabled: true,
          tools: [{ name: "some_tool", description: "Some tool" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    assert.ok(
      !catalog.some((t) => t.serverName === "disabled-server"),
      "disabled server tools should be excluded",
    );
  });

  test("server disabled via VS Code mcp.servers settings is excluded", async () => {
    const env = new MockMcpEnvironmentProvider();
    env.vsCodeDisabledServers = new Set(["disabled-by-settings"]);
    const { registry } = makeRegistry(
      {
        "/mock/workspace/.vscode/mcp.json": mcpJson({
          "disabled-by-settings": {
            command: "node",
            tools: [{ name: "t", description: "tool" }],
          },
        }),
      },
      { env },
    );
    const catalog = await registry.ensureCatalog();
    assert.ok(
      !catalog.some((t) => t.serverName === "disabled-by-settings"),
      "settings-disabled server should be excluded",
    );
  });

  // ── 5 MB parse cap ─────────────────────────────────────────────────────────

  test("config files larger than 5 MB are skipped without parsing", async () => {
    const big = mcpJson({
      "big-server": {
        command: "node",
        tools: [{ name: "big_tool", description: "Should not be parsed" }],
      },
    });
    const { registry, fs, logger } = makeRegistry({
      "/mock/home/.claude.json": big,
    });
    // Simulate the multi-MB ~/.claude.json pathology: big size, short content
    // in the mock is fine — the cap is applied on stat().size.
    fs.stats.set("/mock/home/.claude.json", { mtimeMs: 1_000, size: 5 * MB + 1 });
    const catalog = await registry.ensureCatalog();
    assert.ok(
      !catalog.some((t) => t.serverName === "big-server"),
      "oversized config must be skipped",
    );
    assert.ok(
      logger.warnings.some((w) => w.includes(".claude.json") && w.includes("5")),
      "oversized skip should be logged",
    );
  });

  // ─── ensureCatalog caching: fingerprint, invalidation, SWR ────────────────

  test("ensureCatalog is cached: repeated calls do not re-run discovery", async () => {
    const { registry, logger, config } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    config.setMcpProvisioningOptions({ cacheTtlMinutes: 60 });
    await registry.ensureCatalog();
    const discoveryLogs = () =>
      logger.logs.filter((l) => l.includes("discovered")).length;
    const afterFirst = discoveryLogs();
    await registry.ensureCatalog();
    await registry.ensureCatalog();
    assert.strictEqual(
      discoveryLogs(),
      afterFirst,
      "cached catalog must not rediscover within TTL",
    );
  });

  test("stale-while-revalidate: changed file returns cached catalog first, fresh next", async () => {
    const { registry, fs } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    const first = await registry.ensureCatalog();
    assert.ok(first.some((t) => t.qualifiedName === "db-mcp.query"));

    // Change the file on disk (new mtime + content)
    const changed = mcpJson({
      "db-mcp": {
        command: "node",
        tools: [{ name: "query", description: "Execute SQL v2" }],
      },
    });
    fs.files.set("/mock/workspace/.vscode/mcp.json", changed);
    fs.stats.set("/mock/workspace/.vscode/mcp.json", {
      mtimeMs: 2_000,
      size: changed.length,
    });

    // Stale-while-revalidate: immediate result is still the cached one…
    const stale = await registry.ensureCatalog();
    assert.ok(
      stale.some((t) => t.description === "Execute SQL"),
      "SWR must return the cached catalog immediately",
    );
    // …and the background refresh lands before the next call.
    await settle();
    const fresh = await registry.ensureCatalog();
    assert.ok(
      fresh.some((t) => t.description === "Execute SQL v2"),
      "refreshed catalog must be visible after background revalidation",
    );
  });

  test("watcher event invalidates the cache (mtime/size unchanged)", async () => {
    const { registry, watcher, logger } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    await registry.ensureCatalog();
    const discoveryLogs = () =>
      logger.logs.filter((l) => l.includes("discovered")).length;
    const before = discoveryLogs();

    watcher.fire(); // e.g. mcp.servers setting changed (not fingerprinted by file stat)
    await registry.ensureCatalog();
    await settle();
    assert.ok(
      discoveryLogs() > before,
      "watcher bump must force a revalidation pass",
    );
  });

  test("TTL expiry revalidates even when the fingerprint is unchanged", async () => {
    const { registry, logger, config } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    config.setMcpProvisioningOptions({ cacheTtlMinutes: 0 });
    await registry.ensureCatalog();
    const discoveryLogs = () =>
      logger.logs.filter((l) => l.includes("discovered")).length;
    const before = discoveryLogs();
    await registry.ensureCatalog();
    await settle();
    assert.ok(discoveryLogs() > before, "zero TTL must revalidate every call");
  });

  test("getCatalogFingerprint changes when a config file changes", async () => {
    const { registry, fs } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    await registry.ensureCatalog();
    const fp1 = registry.getCatalogFingerprint();
    assert.ok(typeof fp1 === "string" && fp1.length > 0);
    fs.stats.set("/mock/workspace/.vscode/mcp.json", { mtimeMs: 9_999, size: 1 });
    await registry.ensureCatalog();
    await settle();
    const fp2 = registry.getCatalogFingerprint();
    assert.notStrictEqual(fp1, fp2, "fingerprint must reflect mtime/size");
  });

  test("malformed config JSON is skipped with a warning", async () => {
    const { registry, logger } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": "{ not valid json",
    });
    const catalog = await registry.ensureCatalog();
    assert.deepStrictEqual(catalog, []);
    assert.ok(
      logger.warnings.some((w) => w.includes("mcp.json")),
      "malformed config should warn",
    );
  });

  // ── formatForSystemPrompt ──────────────────────────────────────────────────

  test("formatForSystemPrompt returns empty string for empty input", async () => {
    const { registry } = makeRegistry({});
    await registry.ensureCatalog();
    assert.strictEqual(registry.formatForSystemPrompt([]), "");
  });

  test("formatForSystemPrompt includes qualified names and descriptions", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    const output = registry.formatForSystemPrompt(catalog);
    assert.ok(output.includes("`db-mcp.query`"), "should include qualified name");
    assert.ok(output.includes("Execute SQL"), "should include description");
  });

  test("formatForSystemPrompt guidance states semantic identifiers, runtime-ID mapping, and ignore-unresolvable", async () => {
    const { registry } = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    const catalog = await registry.ensureCatalog();
    const output = registry.formatForSystemPrompt(catalog);
    assert.ok(
      output.includes("semantic identifiers"),
      "guidance must present server.tool names as semantic identifiers",
    );
    assert.ok(
      output.includes("runtime IDs") && output.includes("mcp_"),
      "guidance must mention runtime-ID mapping (mcp_-prefixed names)",
    );
    assert.ok(
      output.includes("OMIT") && output.includes("not probe for or invent"),
      "guidance must say to ignore unresolvable references, never probe",
    );
  });

  test("formatForSystemPrompt sanitizes descriptions (control chars, newlines, whitespace, 200-char cap)", () => {
    const { registry } = makeRegistry({});
    const tool = {
      serverName: "s",
      toolName: "t",
      qualifiedName: "s.t",
      description:
        "Line one\nwith a newline\tand a tab\r\nand   multiple    spaces\n\n" +
        "plus \x00\x07 control \x1b[31m chars\x1b[0m",
      enabled: true,
      source: "vscode-workspace" as const,
      sources: ["vscode-workspace" as const],
      visibility: "injectable" as const,
      origin: "inline-schema" as const,
    };
    const output = registry.formatForSystemPrompt([tool]);
    const descLine = output.split("\n").find((l) => l.startsWith("- `s.t`"))!;
    assert.ok(descLine, "tool line present");
    assert.ok(!/[\x00-\x1F\x7F]/.test(descLine), "no control characters remain");
    assert.ok(!descLine.includes("\n"), "newlines stripped from description");
    assert.ok(
      !descLine.includes("multiple    spaces"),
      "whitespace runs collapsed",
    );
    assert.ok(descLine.includes("multiple spaces"), "single spaces preserved");
    // 200-char per-description cap (line prefix + description + marker).
    assert.ok(descLine.length <= "- `s.t`: ".length + 200);
  });

  test("formatForSystemPrompt caps descriptions at 200 characters", () => {
    const { registry } = makeRegistry({});
    const long = "a".repeat(500);
    const tool = {
      serverName: "s",
      toolName: "t",
      qualifiedName: "s.t",
      description: long,
      enabled: true,
      source: "vscode-workspace" as const,
      sources: ["vscode-workspace" as const],
      visibility: "injectable" as const,
      origin: "inline-schema" as const,
    };
    const output = registry.formatForSystemPrompt([tool]);
    const descLine = output.split("\n").find((l) => l.startsWith("- `s.t`"))!;
    assert.ok(
      descLine.length <= "- `s.t`: ".length + 200,
      `description must be capped at 200 chars (got ${descLine.length})`,
    );
    assert.ok(descLine.includes("…"), "truncation is marked");
  });

  test("formatForSystemPrompt annotates foreign-visibility tools as other-editor", () => {
    const { registry } = makeRegistry({});
    const tool = {
      serverName: "cursor-server",
      toolName: "t",
      qualifiedName: "cursor-server.t",
      description: "From another editor",
      enabled: true,
      source: "cursor" as const,
      sources: ["cursor" as const],
      visibility: "foreign" as const,
      origin: "inline-schema" as const,
    };
    const output = registry.formatForSystemPrompt([tool]);
    assert.ok(
      output.includes("other-editor tool"),
      "foreign tools carry the only-use-if-available annotation",
    );
  });

  test("formatForSystemPrompt keeps the tool list within the ~1500-char budget", () => {
    const { registry } = makeRegistry({});
    const tools = Array.from({ length: 20 }, (_, i) => ({
      serverName: `server-${i}`,
      toolName: `tool-${i}`,
      qualifiedName: `server-${i}.tool-${i}`,
      description: `d${i}-`.repeat(50), // ~200 chars each → 20 lines ≈ 4000+ chars
      enabled: true,
      source: "vscode-workspace" as const,
      sources: ["vscode-workspace" as const],
      visibility: "injectable" as const,
      origin: "inline-schema" as const,
    }));
    const output = registry.formatForSystemPrompt(tools);
    assert.ok(
      output.includes("tool list truncated"),
      "budget exhaustion is visible",
    );
    const toolLines = output
      .split("\n")
      .filter((l) => l.startsWith("- `server-"));
    const described = toolLines.reduce((acc, l) => acc + l.length, 0);
    assert.ok(
      described <= 1500 + 200,
      `tool-list portion must stay near the ~1500 budget (got ${described})`,
    );
  });

  // ── Waterfall: runtime > probe-cache > manual-index > inline > stub ───────

  suite("waterfall priority (runtime / probe-cache / manual-index)", () => {
    test("runtime tools register without any config file (F1 acceptance shape)", async () => {
      const runtime = new MockRuntimeToolsProvider();
      runtime.available = true;
      runtime.tools = [
        {
          runtimeName: "mcp_postgres-mcp_query_db",
          serverName: "postgres-mcp",
          toolName: "query_db",
          description: "Execute SQL queries against the project database",
        },
      ];
      const { registry } = makeRegistry({}, { runtime });
      const catalog = await registry.ensureCatalog();
      const tool = catalog.find(
        (t) => t.qualifiedName === "postgres-mcp.query_db",
      );
      assert.ok(tool, "runtime tool must be in the catalog with no config files");
      assert.strictEqual(tool.source, "vscode-runtime");
      assert.strictEqual(tool.origin, "runtime-api");
      assert.strictEqual(tool.visibility, "injectable");
      assert.ok(tool.description.length > 0, "runtime descriptions are real");
    });

    test("runtime wins dedup over same-name config entries", async () => {
      const runtime = new MockRuntimeToolsProvider();
      runtime.available = true;
      runtime.tools = [
        {
          runtimeName: "mcp_shared-server_real_tool",
          serverName: "shared-server",
          toolName: "real_tool",
          description: "Runtime description",
        },
      ];
      const { registry } = makeRegistry(
        {
          "/mock/workspace/.vscode/mcp.json": mcpJson({
            "shared-server": {
              command: "node",
              tools: [{ name: "inline_tool", description: "Inline description" }],
            },
          }),
        },
        { runtime },
      );
      const catalog = await registry.ensureCatalog();
      assert.ok(
        catalog.some((t) => t.qualifiedName === "shared-server.real_tool"),
        "runtime tool wins",
      );
      assert.ok(
        !catalog.some((t) => t.qualifiedName === "shared-server.inline_tool"),
        "inline tools of a runtime-covered server are superseded",
      );
    });

    test("unavailable runtime provider falls through silently", async () => {
      const runtime = new MockRuntimeToolsProvider();
      runtime.available = false;
      const { registry, runtime: rt } = makeRegistry({}, { runtime });
      const catalog = await registry.ensureCatalog();
      assert.deepStrictEqual(catalog, []);
      assert.strictEqual(rt.listCalls, 0, "unavailable provider is not listed");
    });

    test("manual index entries register and override inline schemas", async () => {
      const indexStore = new MockMcpToolIndexStore();
      indexStore.manualEntries = [
        {
          server: "db-mcp",
          name: "query",
          description: "Curated description",
        },
      ];
      const { registry } = makeRegistry(
        {
          "/mock/workspace/.vscode/mcp.json": mcpJson({
            "db-mcp": {
              command: "node",
              tools: [{ name: "query", description: "Stale inline description" }],
            },
          }),
        },
        { indexStore },
      );
      const catalog = await registry.ensureCatalog();
      const tool = catalog.find((t) => t.qualifiedName === "db-mcp.query");
      assert.ok(tool, "manual entry present");
      assert.strictEqual(tool.description, "Curated description");
      assert.strictEqual(tool.source, "manual-index");
      assert.strictEqual(tool.origin, "manual-index");
      assert.strictEqual(catalog.length, 1, "inline duplicate replaced, not added");
    });

    test("manual index registers servers no config declares", async () => {
      const indexStore = new MockMcpToolIndexStore();
      indexStore.manualEntries = [
        { server: "ghost-mcp", name: "boo", description: "User curated" },
      ];
      const { registry } = makeRegistry({}, { indexStore });
      const catalog = await registry.ensureCatalog();
      const tool = catalog.find((t) => t.qualifiedName === "ghost-mcp.boo");
      assert.ok(tool, "manual-only server is registered");
      assert.ok(registry.getServerNames().includes("ghost-mcp"));
    });

    test("runtime beats manual index for the same server", async () => {
      const runtime = new MockRuntimeToolsProvider();
      runtime.available = true;
      runtime.tools = [
        {
          runtimeName: "mcp_db-mcp_query",
          serverName: "db-mcp",
          toolName: "query",
          description: "Runtime truth",
        },
      ];
      const indexStore = new MockMcpToolIndexStore();
      indexStore.manualEntries = [
        { server: "db-mcp", name: "query", description: "Stale curated" },
      ];
      const { registry } = makeRegistry({}, { runtime, indexStore });
      const catalog = await registry.ensureCatalog();
      const tool = catalog.find((t) => t.qualifiedName === "db-mcp.query");
      assert.ok(tool);
      assert.strictEqual(tool.origin, "runtime-api");
    });

    test("probe cache fills stub servers and beats the manual index", async () => {
      const indexStore = new MockMcpToolIndexStore();
      indexStore.manualEntries = [
        { server: "probed-mcp", name: "cached_tool", description: "Old curated" },
      ];
      indexStore.probeCache.set(
        JSON.stringify(["node", ["probe.js"]]),
        [
          { name: "cached_tool", description: "Fresh probe description" },
          { name: "other_tool", description: "Also probed" },
        ],
      );
      const { registry } = makeRegistry(
        {
          "/mock/workspace/.vscode/mcp.json": mcpJson({
            "probed-mcp": { command: "node", args: ["probe.js"] },
          }),
        },
        { indexStore },
      );
      const catalog = await registry.ensureCatalog();
      const tool = catalog.find(
        (t) => t.qualifiedName === "probed-mcp.cached_tool",
      );
      assert.ok(tool, "probe-cache tool present");
      assert.strictEqual(tool.source, "probe-cache");
      assert.strictEqual(tool.origin, "probe");
      assert.strictEqual(tool.description, "Fresh probe description");
      assert.ok(
        catalog.some((t) => t.qualifiedName === "probed-mcp.other_tool"),
        "all cached tools registered",
      );
    });

    test("probe cache miss leaves the stub tool-less (name-level only)", async () => {
      const { registry, indexStore } = makeRegistry({
        "/mock/workspace/.vscode/mcp.json": mcpJson({
          "stub-mcp": { command: "node", args: ["never-probed.js"] },
        }),
      });
      assert.deepStrictEqual(indexStore.probeCache, new Map());
      const catalog = await registry.ensureCatalog();
      assert.deepStrictEqual(catalog, [], "stub contributes no descriptors");
      assert.deepStrictEqual(registry.getServerNames(), ["stub-mcp"]);
    });

    test("getProbeTargets lists enabled stub servers with launch commands", async () => {
      const { registry } = makeRegistry({
        "/mock/workspace/.vscode/mcp.json": mcpJson({
          "stub-mcp": { command: "node", args: ["s.js"] },
          "disabled-stub": { command: "node", disabled: true },
          "inline-mcp": {
            command: "node",
            tools: [{ name: "t", description: "has tools" }],
          },
        }),
      });
      await registry.ensureCatalog();
      const targets = registry.getProbeTargets();
      assert.strictEqual(targets.length, 1);
      assert.strictEqual(targets[0].serverName, "stub-mcp");
      assert.strictEqual(targets[0].command, "node");
      assert.deepStrictEqual(targets[0].args, ["s.js"]);
    });

    test("manual index changes invalidate the fingerprint", async () => {
      const indexStore = new MockMcpToolIndexStore();
      indexStore.manualEntries = [
        { server: "manual-mcp", name: "tool", description: "one" },
      ];
      const { registry, fs } = makeRegistry({}, { indexStore });
      await registry.ensureCatalog();
      const fp1 = registry.getCatalogFingerprint();
      // Simulate the index file being edited (mtime/size change)
      fs.stats.set(indexStore.getManualIndexPath(), {
        mtimeMs: 5_000,
        size: 123,
      });
      await registry.ensureCatalog();
      await settle();
      assert.notStrictEqual(
        registry.getCatalogFingerprint(),
        fp1,
        "index file change must invalidate",
      );
    });
  });
});
