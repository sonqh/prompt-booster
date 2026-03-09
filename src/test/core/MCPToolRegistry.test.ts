/**
 * Tests for MCPToolRegistry
 *
 * Uses MockFileSystem to inject fake config file content without touching
 * the real filesystem. The MCPToolRegistry is instantiated directly (no DI).
 */
import * as assert from "assert";
import { MCPToolRegistry } from "../../core/services/MCPToolRegistry";
import { MockFileSystem } from "../mocks/MockServices";
import { MockLogger } from "../mocks/MockLogger";

/** Build an MCPToolRegistry pointing at a mock FS with injected files. */
function makeRegistry(files: Record<string, string>): MCPToolRegistry {
  const fs = new MockFileSystem();
  for (const [k, v] of Object.entries(files)) {
    fs.files.set(k, v);
  }
  return new MCPToolRegistry(fs, new MockLogger());
}

/** Convenience: JSON for a minimal mcp.json with named servers + tool schemas. */
function mcpJson(
  servers: Record<
    string,
    {
      command?: string;
      tools?: { name: string; description?: string }[];
      disabled?: boolean;
    }
  >,
): string {
  return JSON.stringify({ servers });
}

suite("MCPToolRegistry", () => {
  // ── Basic discovery ────────────────────────────────────────────────────────

  test("discovers tools from .vscode/mcp.json", async () => {
    const reg = makeRegistry({
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
    await reg.discover();
    const catalog = reg.getToolCatalog();
    assert.strictEqual(catalog.length, 2);
    assert.ok(
      catalog.some((t) => t.qualifiedName === "postgres-mcp.query_db"),
      "should have postgres-mcp.query_db",
    );
  });

  test("falls back to .cline/mcp.json when .vscode/mcp.json is absent", async () => {
    const reg = makeRegistry({
      "/mock/workspace/.cline/mcp.json": mcpJson({
        "cline-server": {
          command: "node",
          tools: [{ name: "read_file", description: "Read a file" }],
        },
      }),
    });
    await reg.discover();
    const catalog = reg.getToolCatalog();
    assert.ok(
      catalog.some((t) => t.qualifiedName === "cline-server.read_file"),
      "should fall back to Cline config",
    );
  });

  test("falls back to .github/copilot/mcp.json when .vscode/mcp.json is absent", async () => {
    const reg = makeRegistry({
      "/mock/workspace/.github/copilot/mcp.json": mcpJson({
        "copilot-server": {
          command: "node",
          tools: [{ name: "search", description: "Search codebase" }],
        },
      }),
    });
    await reg.discover();
    const catalog = reg.getToolCatalog();
    assert.ok(
      catalog.some((t) => t.qualifiedName === "copilot-server.search"),
      "should fall back to GitHub Copilot config",
    );
  });

  test("returns empty catalog when no config files exist", async () => {
    const reg = makeRegistry({});
    await reg.discover(); // should not throw
    assert.deepStrictEqual(reg.getToolCatalog(), []);
  });

  // ── Deduplication ──────────────────────────────────────────────────────────

  test("deduplicates servers across sources (first source wins)", async () => {
    const reg = makeRegistry({
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
    await reg.discover();
    const catalog = reg.getToolCatalog();
    assert.ok(
      catalog.some((t) => t.toolName === "from_vscode"),
      "first source (vscode) should win",
    );
    assert.ok(
      !catalog.some((t) => t.toolName === "from_cline"),
      "duplicate server from Cline should be ignored",
    );
  });

  // ── Enablement checks ──────────────────────────────────────────────────────

  test("server with empty command is skipped (not in catalog)", async () => {
    const reg = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "broken-server": {
          command: "",
          tools: [{ name: "broken_tool", description: "A broken tool" }],
        },
      }),
    });
    await reg.discover();
    const catalog = reg.getToolCatalog();
    assert.ok(
      !catalog.some((t) => t.serverName === "broken-server"),
      "server with empty command should be excluded",
    );
  });

  test("server with disabled:true is excluded from getToolCatalog()", async () => {
    const reg = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "disabled-server": {
          command: "node",
          disabled: true,
          tools: [{ name: "some_tool", description: "Some tool" }],
        },
      }),
    });
    await reg.discover();
    const catalog = reg.getToolCatalog();
    assert.ok(
      !catalog.some((t) => t.serverName === "disabled-server"),
      "disabled server tools should be excluded",
    );
  });

  // ── formatForSystemPrompt ──────────────────────────────────────────────────

  test("formatForSystemPrompt returns empty string for empty input", async () => {
    const reg = makeRegistry({});
    await reg.discover();
    const output = reg.formatForSystemPrompt([]);
    assert.strictEqual(output, "");
  });

  test("formatForSystemPrompt includes qualified names and descriptions", async () => {
    const reg = makeRegistry({
      "/mock/workspace/.vscode/mcp.json": mcpJson({
        "db-mcp": {
          command: "node",
          tools: [{ name: "query", description: "Execute SQL" }],
        },
      }),
    });
    await reg.discover();
    const catalog = reg.getToolCatalog();
    const output = reg.formatForSystemPrompt(catalog);
    assert.ok(output.includes("`db-mcp.query`"), "should include qualified name");
    assert.ok(output.includes("Execute SQL"), "should include description");
  });
});
