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
}

/** Build a hermetic registry over mock files. */
function makeRegistry(
  files: Record<string, string>,
  overrides: Partial<{
    env: MockMcpEnvironmentProvider;
    config: MockConfigurationManager;
  }> = {},
): RegistryHarness {
  const fs = new MockFileSystem();
  for (const [k, v] of Object.entries(files)) {
    fs.files.set(k, v);
    fs.stats.set(k, { mtimeMs: 1_000, size: v.length });
  }
  const env = overrides.env ?? new MockMcpEnvironmentProvider();
  const config = overrides.config ?? new MockConfigurationManager();
  const watcher = new MockConfigChangeWatcher();
  const logger = new MockLogger();
  const registry = new MCPToolRegistry(fs, logger, env, watcher, config);
  return { registry, fs, env, watcher, config, logger };
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
});
