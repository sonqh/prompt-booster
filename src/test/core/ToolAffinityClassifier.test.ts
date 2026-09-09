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
  source: "vscode-workspace",
  sources: ["vscode-workspace"],
  visibility: "injectable",
  origin: "inline-schema",
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
  source: "vscode-workspace",
  sources: ["vscode-workspace"],
  visibility: "injectable",
  origin: "inline-schema",
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

  // ── MCP tool scoring (scorer v2 — plan section 7 worked examples) ─────────

  // Worked example 1: single generic token match must NOT qualify (F3 fix).
  test("rejects a tool matching only one generic description token", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
    ];
    const { mcpTools } = classifyTools("check the slow query on the dashboard", catalog);
    assert.deepStrictEqual(
      mcpTools,
      [],
      "matched {query} ⇒ base 1, lengthNorm 1/√4 = 0.5 < 2.0 — rejected",
    );
  });

  // Worked example 2: multiple matched content tokens qualify.
  test("qualifies a tool when several description tokens match", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
    ];
    const { mcpTools } = classifyTools("profile the slow query on the project database", catalog);
    assert.ok(
      mcpTools.some((t) => t.qualifiedName === "postgres-mcp.query_db"),
      "matched {query, project, database} = 1+2+2 = 5 ⇒ 5/√4 = 2.5 ≥ 2.0",
    );
  });

  // Worked example 3: the "Read a file" false-positive class (F3).
  test("rejects filesystem tool for a prompt whose 'file' token is stopworded", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("fs-mcp", "read_file", "Read a file from the local filesystem"),
    ];
    const { mcpTools } = classifyTools("fix the bug in this file", catalog);
    assert.deepStrictEqual(
      mcpTools,
      [],
      "'file' is a stopword; matched {} ⇒ 0 — rejected",
    );
  });

  // Worked example 4: whole-word server-name bonus outranks description score.
  test("whole-word server name in the prompt qualifies and ranks first", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
      enabledTool("github-mcp", "create_pr", "Create a pull request on GitHub"),
    ];
    const { mcpTools } = classifyTools(
      "use postgres-mcp to run the slow query",
      catalog,
    );
    assert.ok(
      mcpTools.length > 0 && mcpTools[0].qualifiedName === "postgres-mcp.query_db",
      "nameBonus 4 ⇒ qualified and ranked first regardless of description",
    );
  });

  // Worked example 5: laundry-list descriptions are penalized by lengthNorm.
  test("penalizes laundry-list descriptions in favor of a focused tool", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool(
        "kitchen-sink-mcp",
        "everything",
        "create read update delete queries projects databases files folders tables columns rows everything",
      ),
      enabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
    ];
    const { mcpTools } = classifyTools("profile the slow query on the project database", catalog);
    assert.ok(
      mcpTools.some((t) => t.qualifiedName === "postgres-mcp.query_db"),
      "focused tool qualifies (5/√4 = 2.5)",
    );
    assert.ok(
      !mcpTools.some((t) => t.qualifiedName === "kitchen-sink-mcp.everything"),
      "laundry-list tool: same matched base 5 but 5/√12 ≈ 1.44 < 2.0 — rejected",
    );
  });

  test("does NOT match disabled MCP tool even when it would qualify", () => {
    const catalog: MCPToolDescriptor[] = [
      disabledTool("postgres-mcp", "query_db", "Execute SQL queries against the project database"),
    ];
    const { mcpTools } = classifyTools("profile the slow query on the project database", catalog);
    assert.deepStrictEqual(
      mcpTools,
      [],
      "disabled tools should never be suggested",
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

  test("deterministic: identical input yields identical output order", () => {
    const catalog: MCPToolDescriptor[] = [
      enabledTool("alpha-mcp", "query_db", "Query the project database"),
      enabledTool("beta-mcp", "analyze_db", "Analyze the project database"),
      enabledTool("gamma-mcp", "audit_db", "Audit the project database"),
    ];
    const prompt = "query analyze audit the project database";
    const first = classifyTools(prompt, catalog).mcpTools.map((t) => t.qualifiedName);
    const second = classifyTools(prompt, catalog).mcpTools.map((t) => t.qualifiedName);
    assert.deepStrictEqual(first, second);
    assert.ok(first.length > 0);
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
