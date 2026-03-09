/**
 * Tests for ToolAffinityClassifier
 *
 * Runs under the VS Code Extension host using Mocha (tdd style).
 * Uses only pure function calls — no VS Code API needed for this module.
 */
import * as assert from "assert";
import {
  classifyTools,
  MCPToolDescriptor,
} from "../../core/services/ToolAffinityClassifier";

const enabledTool = (
  serverName: string,
  toolName: string,
  description: string,
): MCPToolDescriptor => ({
  serverName,
  toolName,
  qualifiedName: `${serverName}.${toolName}`,
  description,
  enabled: true,
});

const disabledTool = (
  serverName: string,
  toolName: string,
  description: string,
): MCPToolDescriptor => ({
  serverName,
  toolName,
  qualifiedName: `${serverName}.${toolName}`,
  description,
  enabled: false,
});

suite("ToolAffinityClassifier", () => {
  // ── Built-in tool detection ──────────────────────────────────────────────

  test("detects #editor for 'fix the bug in this file'", () => {
    const { suggestedTools } = classifyTools("fix the bug in this file");
    assert.ok(suggestedTools.includes("#editor"), "should suggest #editor");
  });

  test("detects @workspace for 'search for all usages of fetchUser'", () => {
    const { suggestedTools } = classifyTools(
      "search for all usages of fetchUser",
    );
    assert.ok(suggestedTools.includes("@workspace"), "should suggest @workspace");
  });

  test("detects @terminal + #terminalLastCommand for 'run the tests and check the error'", () => {
    const { suggestedTools } = classifyTools(
      "run the tests and check the error",
    );
    assert.ok(suggestedTools.includes("@terminal"), "should suggest @terminal");
    assert.ok(
      suggestedTools.includes("#terminalLastCommand"),
      "should suggest #terminalLastCommand",
    );
  });

  test("detects #codebase for 'refactor the entire project'", () => {
    const { suggestedTools } = classifyTools("refactor the entire project");
    assert.ok(suggestedTools.includes("#codebase"), "should suggest #codebase");
  });

  test("detects @vscode for prompt about settings", () => {
    const { suggestedTools } = classifyTools(
      "how do I change a keybinding in vscode",
    );
    assert.ok(suggestedTools.includes("@vscode"), "should suggest @vscode");
  });

  test("returns empty lists for a prompt with no signals", () => {
    const { suggestedTools, mcpTools, toolAnnotations } = classifyTools(
      "hello world",
    );
    assert.deepStrictEqual(suggestedTools, []);
    assert.deepStrictEqual(mcpTools, []);
    assert.strictEqual(toolAnnotations, "");
  });

  // ── MCP tool scoring ──────────────────────────────────────────────────────

  test("matches enabled MCP tool by description keyword", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
    ];
    const { mcpTools } = classifyTools("check the slow query on the dashboard", catalog);
    assert.ok(
      mcpTools.some((t) => t.qualifiedName === "postgres-mcp.query_db"),
      "should match postgres-mcp.query_db",
    );
  });

  test("does NOT match disabled MCP tool even if description matches", () => {
    const catalog: MCPToolDescriptor[] = [
      disabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
    ];
    const { mcpTools } = classifyTools("check the slow query on the database", catalog);
    assert.deepStrictEqual(
      mcpTools,
      [],
      "disabled tools should never be suggested",
    );
  });

  test("gives bonus score for server name mentioned in prompt", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("postgres-mcp", "query_db", "Execute SQL queries"),
      enabledTool("github-mcp", "create_pr", "Create a pull request on GitHub"),
    ];
    const { mcpTools } = classifyTools(
      "use postgres-mcp to run the slow query",
      catalog,
    );
    assert.ok(
      mcpTools.length > 0 && mcpTools[0].serverName === "postgres-mcp",
      "postgres-mcp should rank first",
    );
  });

  test("no MCP matches for unrelated prompt", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
    ];
    const { mcpTools } = classifyTools("fix the null reference bug", catalog);
    assert.deepStrictEqual(mcpTools, []);
  });

  test("caps MCP results at 5", () => {
    const catalog: MCPToolDescriptor[] = Array.from({ length: 10 }, (_, i) =>
      enabledTool("data-mcp", `query_${i}`, "Query database records with SQL"),
    );
    const { mcpTools } = classifyTools("query the database records", catalog);
    assert.ok(mcpTools.length <= 5, `expected ≤5 results, got ${mcpTools.length}`);
  });

  // ── toolAnnotations ───────────────────────────────────────────────────────

  test("toolAnnotations is empty when nothing matches", () => {
    const { toolAnnotations } = classifyTools("hello world", []);
    assert.strictEqual(toolAnnotations, "");
  });

  test("toolAnnotations contains placement guidance for matched tools", () => {
    const { toolAnnotations } = classifyTools("fix the error in this file");
    assert.ok(
      toolAnnotations.includes("[Tool placement guidance"),
      "should include placement guidance header",
    );
  });
});
