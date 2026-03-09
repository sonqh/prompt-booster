/**
 * MCPToolRegistry — Enhancement 4
 *
 * Discovers MCP servers from multiple configuration sources and builds a catalog
 * of available tools for injection into the optimizer prompt. This service is
 * READ-ONLY — it never connects to or executes any MCP server.
 *
 * Discovery waterfall (highest to lowest priority):
 *   1. .vscode/mcp.json               (VS Code workspace)
 *   2. VS Code settings → mcp.servers  (VS Code user/workspace config)
 *   3. ~/.claude/claude_desktop_config.json  (Claude Desktop global)
 *   4. ~/.claude.json / .claude/settings.json (Claude Code)
 *   5. .github/copilot/mcp.json       (GitHub Copilot repo)
 *   6. .cursor/mcp.json               (Cursor IDE workspace)
 *   7. .cline/mcp.json                (Cline workspace)
 *   8. vscode.lm.tools API            (future — no-op placeholder)
 *
 * After discovery, each server goes through an enablement check:
 *   - VS Code sources: cross-referenced against the mcp.servers disabled list
 *   - Non-VS Code sources: treated as enabled; servers with no `command` are skipped
 */
import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import { ILogger } from "../../shared/interfaces/ILogger";

export interface MCPToolDescriptor {
  serverName: string;       // e.g. "postgres-mcp"
  toolName: string;          // e.g. "query_db"
  qualifiedName: string;     // e.g. "postgres-mcp.query_db"
  description: string;
  inputSummary?: string;
  /** True when the server was confirmed not-disabled in its config source. */
  enabled: boolean;
}

interface RawServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  disabled?: boolean;
}

export class MCPToolRegistry {
  private catalog: MCPToolDescriptor[] = [];
  /** Track server names already registered (deduplication). */
  private registeredNames = new Set<string>();

  constructor(
    private fileSystem: IFileSystem,
    private logger: ILogger,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run the discovery waterfall. Clears any previous catalog first.
   * All sources fail silently — graceful degradation is guaranteed.
   */
  async discover(): Promise<void> {
    this.catalog = [];
    this.registeredNames = new Set();

    await this.discoverFromVscodeWorkspace();
    this.discoverFromVscodeSettings();
    await this.discoverFromClaudeDesktop();
    await this.discoverFromClaudeCode();
    await this.discoverFromGitHubCopilot();
    await this.discoverFromCursor();
    await this.discoverFromCline();
    await this.discoverFromRuntime();

    this.logger.log(
      `MCPToolRegistry: discovered ${this.registeredNames.size} servers, ` +
        `${this.catalog.length} tools (${
          this.catalog.filter((t) => t.enabled).length
        } enabled)`,
    );
  }

  /** Returns only enabled tools. */
  getToolCatalog(): MCPToolDescriptor[] {
    return this.catalog.filter((t) => t.enabled);
  }

  /** Returns all registered server names (including disabled). */
  getServerNames(): string[] {
    return Array.from(this.registeredNames);
  }

  /**
   * Format a compact catalog block for injection into the LLM system prompt.
   * Only call this with the already-filtered top-N relevant tools.
   */
  formatForSystemPrompt(tools: MCPToolDescriptor[]): string {
    if (tools.length === 0) return "";

    const lines = [
      "Available MCP Tools (use ONLY if clearly relevant to the task):",
      ...tools.map(
        (t) =>
          `- \`${t.qualifiedName}\`: ${t.description}${
            t.inputSummary ? ` (${t.inputSummary})` : ""
          }`,
      ),
      "",
      'If an MCP tool is relevant, embed it inline (e.g., "run EXPLAIN ANALYZE via',
      '`postgres-mcp.query_db`") at the exact sentence where the tool is needed.',
    ];
    return lines.join("\n");
  }

  // ─── Discovery sources ───────────────────────────────────────────────────────

  /** Source 1: .vscode/mcp.json */
  private async discoverFromVscodeWorkspace(): Promise<void> {
    try {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) return;

      const uri = vscode.Uri.joinPath(wsFolder.uri, ".vscode", "mcp.json");
      const raw = await this.fileSystem.readFile(uri);
      const config = JSON.parse(raw);
      const servers: Record<string, RawServerConfig> =
        config.servers ?? config.mcpServers ?? {};

      // VS Code may mark servers as disabled via workspace settings
      const vsCodeDisabled = this.getVsCodeDisabledServers();

      this.registerServers(servers, (name) => !vsCodeDisabled.has(name), "vscode-workspace");
    } catch {
      /* .vscode/mcp.json not present – normal */
    }
  }

  /** Source 2: VS Code settings → mcp.servers */
  private discoverFromVscodeSettings(): void {
    try {
      const mcpConfig = vscode.workspace.getConfiguration("mcp");
      const servers = mcpConfig.get<Record<string, RawServerConfig>>("servers", {});
      const vsCodeDisabled = this.getVsCodeDisabledServers();
      this.registerServers(servers, (name) => !vsCodeDisabled.has(name), "vscode-settings");
    } catch {
      /* settings not available */
    }
  }

  /** Source 3: Claude Desktop — ~/.claude/claude_desktop_config.json */
  private async discoverFromClaudeDesktop(): Promise<void> {
    try {
      const configPath = path.join(
        os.homedir(),
        ".claude",
        "claude_desktop_config.json",
      );
      const raw = await this.fileSystem.readFile(configPath);
      const config = JSON.parse(raw);
      const servers: Record<string, RawServerConfig> =
        config.mcpServers ?? config.servers ?? {};
      this.registerServers(servers, () => true, "claude-desktop");
    } catch {
      /* not present */
    }
  }

  /** Source 4: Claude Code — ~/.claude.json or .claude/settings.json */
  private async discoverFromClaudeCode(): Promise<void> {
    // Try ~/.claude.json first
    await this.tryReadMcpJson(
      path.join(os.homedir(), ".claude.json"),
      "claude-code-global",
    );

    // Then workspace-level .claude/settings.json
    try {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) return;
      await this.tryReadMcpJson(
        path.join(wsFolder.uri.fsPath, ".claude", "settings.json"),
        "claude-code-workspace",
      );
    } catch {
      /* no workspace */
    }
  }

  /** Source 5: GitHub Copilot — .github/copilot/mcp.json */
  private async discoverFromGitHubCopilot(): Promise<void> {
    try {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) return;
      await this.tryReadMcpJson(
        path.join(wsFolder.uri.fsPath, ".github", "copilot", "mcp.json"),
        "github-copilot",
      );
    } catch {
      /* no workspace */
    }
  }

  /** Source 6: Cursor IDE — .cursor/mcp.json */
  private async discoverFromCursor(): Promise<void> {
    try {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) return;
      await this.tryReadMcpJson(
        path.join(wsFolder.uri.fsPath, ".cursor", "mcp.json"),
        "cursor",
      );
    } catch {
      /* no workspace */
    }
  }

  /** Source 7: Cline — .cline/mcp.json */
  private async discoverFromCline(): Promise<void> {
    try {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) return;
      await this.tryReadMcpJson(
        path.join(wsFolder.uri.fsPath, ".cline", "mcp.json"),
        "cline",
      );
    } catch {
      /* no workspace */
    }
  }

  /** Source 8: VS Code runtime API (future, no-op now) */
  private async discoverFromRuntime(): Promise<void> {
    try {
      // Future: use vscode.lm.tools API when stable
      // const tools = await vscode.lm.tools.list();
    } catch {
      /* API not available yet */
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Read a JSON file at `filePath`, find `servers` / `mcpServers` map,
   * and register all entries. Silently skips if the file doesn't exist.
   */
  private async tryReadMcpJson(
    filePath: string,
    source: string,
  ): Promise<void> {
    try {
      const raw = await this.fileSystem.readFile(filePath);
      const config = JSON.parse(raw);
      const servers: Record<string, RawServerConfig> =
        config.servers ?? config.mcpServers ?? {};
      this.registerServers(servers, () => true, source);
    } catch {
      /* file absent or malformed – skip */
    }
  }

  /**
   * Register servers from a parsed server map into the catalog.
   * `isEnabled` is called per-server-name to apply source-specific checks.
   */
  private registerServers(
    servers: Record<string, RawServerConfig>,
    isEnabled: (name: string) => boolean,
    source: string,
  ): void {
    for (const [name, cfg] of Object.entries(servers)) {
      // Deduplication — first source wins
      if (this.registeredNames.has(name)) continue;
      this.registeredNames.add(name);

      // Enablement check
      const enabled =
        isEnabled(name) &&
        !cfg.disabled &&
        (cfg.command !== undefined && cfg.command.trim() !== "");

      if (!enabled) {
        this.logger.log(
          `MCPToolRegistry [${source}]: server "${name}" is disabled or has no command — skipping`,
        );
      }

      // Register inline tool schemas if present
      if (cfg.tools && Array.isArray(cfg.tools)) {
        for (const tool of cfg.tools) {
          if (!tool.name) continue;
          this.catalog.push({
            serverName: name,
            toolName: tool.name,
            qualifiedName: `${name}.${tool.name}`,
            description: tool.description ?? "",
            inputSummary: this.summarizeInput(tool.inputSchema),
            enabled,
          });
        }
      } else if (enabled) {
        // No inline tool schema — register a stub so name-based scoring can still match
        this.logger.log(
          `MCPToolRegistry [${source}]: server "${name}" has no inline tool schemas; stub registered`,
        );
      }
    }
  }

  /** Return a set of server names explicitly disabled in VS Code mcp settings. */
  private getVsCodeDisabledServers(): Set<string> {
    try {
      const mcpConfig = vscode.workspace.getConfiguration("mcp");
      const servers = mcpConfig.get<Record<string, { disabled?: boolean }>>(
        "servers",
        {},
      );
      return new Set(
        Object.entries(servers)
          .filter(([, cfg]) => cfg.disabled === true)
          .map(([name]) => name),
      );
    } catch {
      return new Set();
    }
  }

  private summarizeInput(schema: unknown): string | undefined {
    if (
      !schema ||
      typeof schema !== "object" ||
      !("properties" in schema) ||
      typeof (schema as Record<string, unknown>).properties !== "object"
    ) {
      return undefined;
    }
    const keys = Object.keys(
      (schema as { properties: Record<string, unknown> }).properties,
    ).slice(0, 3);
    return keys.length > 0 ? `params: ${keys.join(", ")}` : undefined;
  }
}
