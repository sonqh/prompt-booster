/**
 * MCPToolRegistry — Enhancement 4 v2
 *
 * Discovers MCP servers/tools from multiple configuration sources and builds
 * a catalog for injection into the optimizer prompt. This service is
 * READ-ONLY — it never connects to or executes any MCP server on the request
 * path (the opt-in McpServerProbe handles that, off the enhance path).
 *
 * Discovery waterfall (highest to lowest priority; first source wins dedup):
 *   0. vscode.lm.tools runtime API      (via IMcpRuntimeToolsProvider)
 *   1. probe cache                      (via McpToolIndexStore)
 *   2. manual index .vscode/promptbooster-mcp-tools.json (via McpToolIndexStore)
 *   3. inline `tools: [...]` schemas    in the config files below
 *   4. server stubs                     (registered name, no tools — not injectable)
 *
 * Config files (source 3/4 inputs, in priority order):
 *   .vscode/mcp.json, VS Code mcp.servers settings, ~/.claude/claude_desktop_config.json,
 *   ~/.claude.json, .claude/settings.json, .github/copilot/mcp.json, .cursor/mcp.json,
 *   .cline/mcp.json
 *
 * Caching (F4): the catalog is fingerprinted per source file (path + mtimeMs +
 * size) plus a watcher-bumped version. `ensureCatalog()` serves the cached
 * catalog immediately and revalidates in the background (stale-while-
 * revalidate); only the very first call awaits discovery. Config files larger
 * than 5 MB are skipped without parsing.
 *
 * Layering: consumes environment facts through IMcpEnvironmentProvider /
 * IMcpRuntimeToolsProvider / IConfigChangeWatcher ports — no `vscode` import.
 */
import * as path from "path";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import { ILogger } from "../../shared/interfaces/ILogger";
import { IMcpEnvironmentProvider } from "../../shared/interfaces/IMcpEnvironmentProvider";
import { IMcpRuntimeToolsProvider } from "../../shared/interfaces/IMcpRuntimeToolsProvider";
import { IConfigChangeWatcher } from "../../shared/interfaces/IConfigChangeWatcher";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import {
  MCPToolDescriptor,
  McpConfigSource,
  ToolVisibility,
} from "../../shared/types/McpToolTypes";
import { IMcpToolIndexStore } from "./IMcpToolIndexStore";

export type { MCPToolDescriptor } from "../../shared/types/McpToolTypes";

interface RawServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  disabled?: boolean;
}

interface RegisteredServer {
  sources: McpConfigSource[];
  /** Normalized `command + args` signature for dedup-conflict detection. */
  commandSignature: string;
  enabled: boolean;
  config: RawServerConfig;
  descriptors: MCPToolDescriptor[];
}

/**
 * In-progress discovery result. Discovery builds into a scratch state and the
 * registry swaps it in atomically on completion, so a background
 * stale-while-revalidate refresh never empties the served catalog.
 */
interface DiscoveryState {
  catalog: MCPToolDescriptor[];
  servers: Map<string, RegisteredServer>;
}

/** Sources whose tools the downstream Copilot agent cannot be assumed to run. */
const FOREIGN_SOURCES: ReadonlySet<McpConfigSource> = new Set([
  "claude-desktop",
  "claude-code-global",
  "claude-code-workspace",
  "cursor",
  "cline",
]);

function visibilityFor(source: McpConfigSource): ToolVisibility {
  return FOREIGN_SOURCES.has(source) ? "foreign" : "injectable";
}

/** Union of accumulated server sources and the winning source (unique, ordered). */
function mergeSources(
  accumulated: McpConfigSource[],
  winner: McpConfigSource,
): McpConfigSource[] {
  return accumulated.includes(winner)
    ? [...accumulated]
    : [...accumulated, winner];
}

/** Deterministic JSON (sorted keys) so settings fingerprints are stable. */
function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, val]) => [k, sort(val)]),
      );
    }
    return v;
  };
  try {
    return JSON.stringify(sort(value));
  } catch {
    return "";
  }
}

export class MCPToolRegistry {
  /** Hard cap per config file — guards the multi-MB ~/.claude.json pathology. */
  private static readonly MAX_CONFIG_BYTES = 5 * 1024 * 1024;

  private catalog: MCPToolDescriptor[] = [];
  /** All registered servers (name-level data, including disabled and stubs). */
  private serverRegistry = new Map<string, RegisteredServer>();

  // ── Cache state (F4) ────────────────────────────────────────────────────────
  private cachedFingerprint: string | undefined;
  private lastRefreshedAt = 0;
  private watcherVersion = 0;
  private refreshInFlight: Promise<void> | undefined;
  private watcherSubscription: { dispose(): void } | undefined;

  constructor(
    private fileSystem: IFileSystem,
    private logger: ILogger,
    private envProvider: IMcpEnvironmentProvider,
    private runtimeToolsProvider: IMcpRuntimeToolsProvider,
    private indexStore: IMcpToolIndexStore,
    private configWatcher: IConfigChangeWatcher,
    private configManager: IConfigurationManager,
  ) {
    try {
      this.watcherSubscription = this.configWatcher.onConfigChanged(() => {
        // Consumers re-fingerprint to decide whether anything really changed.
        this.watcherVersion++;
      });
    } catch (error) {
      this.logger.warn(
        `MCPToolRegistry: config watcher unavailable (${
          error instanceof Error ? error.message : String(error)
        }) — relying on mtime fingerprinting only`,
      );
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get the (enabled) tool catalog, serving from cache when fresh.
   *
   * Stale-while-revalidate: when the fingerprint (file mtimes/sizes + watcher
   * version) or the TTL says the cache is outdated, the cached catalog is
   * returned IMMEDIATELY and discovery re-runs in the background. Only the
   * very first call (no cache yet) awaits discovery.
   */
  async ensureCatalog(): Promise<MCPToolDescriptor[]> {
    if (this.refreshInFlight) {
      await this.refreshInFlight;
      return this.getToolCatalog();
    }

    const fingerprint = await this.computeFingerprint();
    if (this.cachedFingerprint === undefined) {
      await this.refreshCatalog();
      return this.getToolCatalog();
    }

    const ttlMs =
      this.configManager.getMcpProvisioningOptions().cacheTtlMinutes * 60_000;
    const fresh =
      this.cachedFingerprint === fingerprint &&
      Date.now() - this.lastRefreshedAt < ttlMs;

    if (!fresh) {
      this.refreshInFlight = this.refreshCatalog().finally(() => {
        this.refreshInFlight = undefined;
      });
      // Intentionally not awaited — stale-while-revalidate.
    }
    return this.getToolCatalog();
  }

  /**
   * Fingerprint of the catalog's inputs at the last refresh (file
   * path+mtimeMs+size, watcher version, settings). Stable across calls while
   * nothing changed; used by the response cache and feedback records.
   */
  getCatalogFingerprint(): string {
    return this.cachedFingerprint ?? "";
  }

  /** Release the config-watcher subscription (the watcher itself is owned by the host). */
  dispose(): void {
    try {
      this.watcherSubscription?.dispose();
    } catch {
      /* already disposed */
    }
    this.watcherSubscription = undefined;
  }

  /**
   * Force a full re-discovery, replacing the served catalog atomically on
   * completion (in-progress discovery never mutates the served catalog).
   *
   * Waterfall (per server, highest priority supplies the tool list):
   *   0. vscode-runtime (real tools the Copilot agent can execute)
   *   1. probe-cache    (opt-in cached tools/list handshakes)
   *   2. manual-index   (user-curated .vscode/promptbooster-mcp-tools.json)
   *   3. inline-schema  (rare `tools: [...]` config blocks)
   *   4. stub           (server name only — not injectable)
   *
   * Config sources are read before the index/probe passes because probe
   * targets come from config; the later passes then REPLACE lower-priority
   * descriptors per the priority table above.
   */
  async discover(): Promise<void> {
    const state: DiscoveryState = { catalog: [], servers: new Map() };

    // Priority 0 — runtime must register first so it wins dedup.
    await this.discoverFromRuntime(state);

    // Config sources (inline schemas + stubs + enablement).
    await this.discoverFromVscodeWorkspace(state);
    this.discoverFromVscodeSettings(state);
    await this.discoverFromClaudeDesktop(state);
    await this.discoverFromClaudeCode(state);
    await this.discoverFromGitHubCopilot(state);
    await this.discoverFromCursor(state);
    await this.discoverFromCline(state);

    // Priority 2 — manual index overrides inline schemas, yields to runtime.
    await this.discoverFromManualIndex(state);

    // Priority 1 — fresh probe cache overrides the manual index.
    await this.discoverFromProbeCache(state);

    this.catalog = state.catalog;
    this.serverRegistry = state.servers;

    this.logger.log(
      `MCPToolRegistry: discovered ${this.serverRegistry.size} servers, ` +
        `${this.catalog.length} tools (${
          this.catalog.filter((t) => t.enabled).length
        } enabled)`,
    );
  }

  /** Returns only enabled tools (all visibilities — callers apply policy). */
  getToolCatalog(): MCPToolDescriptor[] {
    return this.catalog.filter((t) => t.enabled);
  }

  /** Enabled tools whose source is injectable for the Copilot agent. */
  getInjectableCatalog(): MCPToolDescriptor[] {
    return this.catalog.filter(
      (t) => t.enabled && t.visibility === "injectable",
    );
  }

  /** All registered server names (including disabled and stub-only). */
  getServerNames(): string[] {
    return Array.from(this.serverRegistry.keys());
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
  private async discoverFromVscodeWorkspace(state: DiscoveryState): Promise<void> {
    const ws = this.envProvider.getWorkspaceFolderPath();
    if (!ws) return;
    await this.discoverFromConfigFile(
      state,
      path.join(ws, ".vscode", "mcp.json"),
      "vscode-workspace",
    );
  }

  /** Source 2: VS Code settings → mcp.servers */
  private discoverFromVscodeSettings(state: DiscoveryState): void {
    try {
      const servers = this.envProvider.getVsCodeServerSettings();
      if (!servers || typeof servers !== "object") return;
      const disabled = this.envProvider.getVsCodeDisabledServers();
      this.registerServers(
        state,
        servers as Record<string, RawServerConfig>,
        (name) => !disabled.has(name),
        "vscode-settings",
      );
    } catch {
      /* settings not available */
    }
  }

  /** Source 3: Claude Desktop — ~/.claude/claude_desktop_config.json */
  private async discoverFromClaudeDesktop(state: DiscoveryState): Promise<void> {
    await this.discoverFromConfigFile(
      state,
      path.join(
        this.envProvider.getHomeDirPath(),
        ".claude",
        "claude_desktop_config.json",
      ),
      "claude-desktop",
    );
  }

  /** Source 4: Claude Code — ~/.claude.json and .claude/settings.json */
  private async discoverFromClaudeCode(state: DiscoveryState): Promise<void> {
    await this.discoverFromConfigFile(
      state,
      path.join(this.envProvider.getHomeDirPath(), ".claude.json"),
      "claude-code-global",
    );
    const ws = this.envProvider.getWorkspaceFolderPath();
    if (!ws) return;
    await this.discoverFromConfigFile(
      state,
      path.join(ws, ".claude", "settings.json"),
      "claude-code-workspace",
    );
  }

  /** Source 5: GitHub Copilot — .github/copilot/mcp.json */
  private async discoverFromGitHubCopilot(state: DiscoveryState): Promise<void> {
    const ws = this.envProvider.getWorkspaceFolderPath();
    if (!ws) return;
    await this.discoverFromConfigFile(
      state,
      path.join(ws, ".github", "copilot", "mcp.json"),
      "github-copilot",
    );
  }

  /** Source 6: Cursor IDE — .cursor/mcp.json */
  private async discoverFromCursor(state: DiscoveryState): Promise<void> {
    const ws = this.envProvider.getWorkspaceFolderPath();
    if (!ws) return;
    await this.discoverFromConfigFile(
      state,
      path.join(ws, ".cursor", "mcp.json"),
      "cursor",
    );
  }

  /** Source 7: Cline — .cline/mcp.json */
  private async discoverFromCline(state: DiscoveryState): Promise<void> {
    const ws = this.envProvider.getWorkspaceFolderPath();
    if (!ws) return;
    await this.discoverFromConfigFile(
      state,
      path.join(ws, ".cline", "mcp.json"),
      "cline",
    );
  }

  // ─── Real tool acquisition (Phase C) ────────────────────────────────────────

  /**
   * Priority 0: vscode.lm.tools runtime API — real descriptions for tools
   * the downstream Copilot agent can actually execute. Runs FIRST so it
   * wins dedup over same-name config entries. Unavailable → silent skip.
   */
  private async discoverFromRuntime(state: DiscoveryState): Promise<void> {
    if (!this.runtimeToolsProvider.isAvailable()) return;

    let tools;
    try {
      tools = await this.runtimeToolsProvider.listTools();
    } catch (error) {
      this.logger.warn(
        `MCPToolRegistry: runtime tool listing failed (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return;
    }
    if (!Array.isArray(tools) || tools.length === 0) return;

    const disabled = this.envProvider.getVsCodeDisabledServers();
    for (const tool of tools) {
      // Unparseable mcp_ names are name-level data only — not injectable.
      if (!tool.serverName || !tool.toolName) continue;
      if (disabled.has(tool.serverName)) continue;

      const server = this.ensureServerEntry(state, tool.serverName, "vscode-runtime");
      if (server.descriptors.some((d) => d.toolName === tool.toolName)) continue;
      const descriptor: MCPToolDescriptor = {
        serverName: tool.serverName,
        toolName: tool.toolName,
        qualifiedName: `${tool.serverName}.${tool.toolName}`,
        description: tool.description ?? "",
        enabled: server.enabled,
        source: "vscode-runtime",
        sources: mergeSources(server.sources, "vscode-runtime"),
        visibility: "injectable",
        origin: "runtime-api",
      };
      server.descriptors.push(descriptor);
      state.catalog.push(descriptor);
      this.logger.log(
        `MCPToolRegistry [vscode-runtime]: ${descriptor.qualifiedName} registered`,
      );
    }
  }

  /**
   * Priority 2: manual index. Entries override inline-schema descriptors for
   * the same server, yield to runtime descriptors, and register servers that
   * no config file declares (the user curated them deliberately).
   */
  private async discoverFromManualIndex(state: DiscoveryState): Promise<void> {
    let entries;
    try {
      entries = await this.indexStore.loadManualIndex();
    } catch {
      return; // store contract is non-throwing; belt and braces
    }
    if (!Array.isArray(entries) || entries.length === 0) return;

    const byServer = new Map<string, typeof entries>();
    for (const entry of entries) {
      const list = byServer.get(entry.server) ?? [];
      list.push(entry);
      byServer.set(entry.server, list);
    }

    for (const [name, serverEntries] of byServer) {
      const existing = state.servers.get(name);
      if (existing?.descriptors.some((d) => d.origin === "runtime-api")) {
        continue; // runtime (priority 0) wins
      }
      if (existing) {
        // Manual index (priority 2) beats inline schemas (priority 3).
        existing.descriptors.forEach((d) => this.removeFromCatalog(state, d));
        existing.descriptors = [];
      }
      const server = this.ensureServerEntry(state, name, "manual-index");
      for (const entry of serverEntries) {
        if (server.descriptors.some((d) => d.toolName === entry.name)) continue;
        const descriptor: MCPToolDescriptor = {
          serverName: name,
          toolName: entry.name,
          qualifiedName: `${name}.${entry.name}`,
          description: entry.description ?? "",
          inputSummary: entry.inputSummary,
          enabled: server.enabled,
          source: "manual-index",
          sources: mergeSources(server.sources, "manual-index"),
          visibility: "injectable",
          origin: "manual-index",
        };
        server.descriptors.push(descriptor);
        state.catalog.push(descriptor);
      }
    }
  }

  /**
   * Priority 1: probe cache. Fills enabled stub servers (tools unknown to
   * configs/runtime) from fresh cached handshakes, overriding manual-index
   * descriptors (which typically persist older probe output anyway).
   */
  private async discoverFromProbeCache(state: DiscoveryState): Promise<void> {
    for (const [name, server] of state.servers) {
      if (!server.enabled) continue;
      const command = server.config.command;
      if (typeof command !== "string" || command.trim() === "") continue;

      const onlyManualOrEmpty = server.descriptors.every(
        (d) => d.origin === "manual-index",
      );
      if (!onlyManualOrEmpty) continue; // runtime/inline already won

      let tools;
      try {
        tools = await this.indexStore.getProbeCache(command, server.config.args);
      } catch {
        continue;
      }
      if (!tools || tools.length === 0) continue;

      server.descriptors.forEach((d) => this.removeFromCatalog(state, d));
      server.descriptors = [];
      for (const tool of tools) {
        if (!tool || typeof tool.name !== "string" || tool.name === "") continue;
        const descriptor: MCPToolDescriptor = {
          serverName: name,
          toolName: tool.name,
          qualifiedName: `${name}.${tool.name}`,
          description: tool.description ?? "",
          inputSummary: this.summarizeInput(tool.inputSchema),
          enabled: server.enabled,
          source: "probe-cache",
          sources: mergeSources(server.sources, "probe-cache"),
          visibility: "injectable",
          origin: "probe",
        };
        server.descriptors.push(descriptor);
        state.catalog.push(descriptor);
      }
    }
  }

  /** Enabled servers with a launch command but no known tools — probe targets. */
  getProbeTargets(): Array<{
    serverName: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }> {
    const targets: Array<{
      serverName: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }> = [];
    for (const [name, server] of this.serverRegistry) {
      if (!server.enabled) continue;
      const command = server.config.command;
      if (typeof command !== "string" || command.trim() === "") continue;
      if (server.descriptors.length > 0) continue;
      targets.push({
        serverName: name,
        command,
        args: server.config.args,
        env: server.config.env,
      });
    }
    return targets;
  }

  /** Find or create a server entry; new entries get the given source. */
  private ensureServerEntry(
    state: DiscoveryState,
    name: string,
    source: McpConfigSource,
  ): RegisteredServer {
    const existing = state.servers.get(name);
    if (existing) return existing;
    const registered: RegisteredServer = {
      sources: [source],
      commandSignature: "", // unknown — never triggers conflict warnings
      enabled: true,
      config: {},
      descriptors: [],
    };
    state.servers.set(name, registered);
    return registered;
  }

  private removeFromCatalog(state: DiscoveryState, descriptor: MCPToolDescriptor): void {
    const index = state.catalog.indexOf(descriptor);
    if (index >= 0) state.catalog.splice(index, 1);
  }

  // ─── Fingerprinting / cache internals ───────────────────────────────────────

  /** Config files the registry reads (workspace- and home-relative). */
  private configFilePaths(): string[] {
    const ws = this.envProvider.getWorkspaceFolderPath();
    const home = this.envProvider.getHomeDirPath();
    const paths: string[] = [
      path.join(home, ".claude", "claude_desktop_config.json"),
      path.join(home, ".claude.json"),
    ];
    if (ws) {
      paths.push(
        path.join(ws, ".vscode", "mcp.json"),
        path.join(ws, ".claude", "settings.json"),
        path.join(ws, ".github", "copilot", "mcp.json"),
        path.join(ws, ".cursor", "mcp.json"),
        path.join(ws, ".cline", "mcp.json"),
      );
    }
    return paths;
  }

  private async computeFingerprint(): Promise<string> {
    const parts: string[] = [`watcher=${this.watcherVersion}`];
    for (const filePath of this.configFilePaths()) {
      const st = await this.fileSystem.stat(filePath);
      parts.push(
        `${filePath}:${st ? `${st.mtimeMs}:${st.size}` : "absent"}`,
      );
    }
    try {
      parts.push(
        `settings:${stableStringify(this.envProvider.getVsCodeServerSettings())}`,
      );
      parts.push(
        `disabled:${Array.from(this.envProvider.getVsCodeDisabledServers())
          .sort()
          .join(",")}`,
      );
    } catch {
      /* environment provider hiccup — fingerprint stays valid without them */
    }
    try {
      // Manual index file + probe cache contribute to catalog inputs.
      const indexPath = this.indexStore.getManualIndexPath();
      const st = await this.fileSystem.stat(indexPath);
      parts.push(`index:${st ? `${st.mtimeMs}:${st.size}` : "absent"}`);
      parts.push(`probe:${this.indexStore.getCacheStamp()}`);
      parts.push(`runtime:${this.runtimeToolsProvider.isAvailable() ? "on" : "off"}`);
    } catch {
      /* index store hiccup — fingerprint stays valid without it */
    }
    return parts.join("|");
  }

  /** Run discovery and record the resulting fingerprint + timestamp. */
  private async refreshCatalog(): Promise<void> {
    try {
      await this.discover();
      this.cachedFingerprint = await this.computeFingerprint();
      this.lastRefreshedAt = Date.now();
    } catch (error) {
      // Discovery must never throw across the enhance path — keep any cached
      // catalog as-is and let the next call retry.
      this.logger.error(
        "MCPToolRegistry: discovery failed; keeping cached catalog",
        error as Error,
      );
    }
  }

  // ─── Registration helpers ───────────────────────────────────────────────────

  /**
   * Read a config file (with the 5 MB parse cap), find its `servers` /
   * `mcpServers` map, and register all entries. Absent files are normal and
   * silent; malformed or oversized files warn and are skipped.
   */
  private async discoverFromConfigFile(
    state: DiscoveryState,
    filePath: string,
    source: McpConfigSource,
  ): Promise<void> {
    let stat: { mtimeMs: number; size: number } | undefined;
    try {
      stat = await this.fileSystem.stat(filePath);
    } catch {
      return; // stat is contractually non-throwing, but stay defensive
    }
    if (!stat) return; // file absent — normal

    if (stat.size > MCPToolRegistry.MAX_CONFIG_BYTES) {
      this.logger.warn(
        `MCPToolRegistry [${source}]: skipping ${filePath} — ` +
          `${(stat.size / (1024 * 1024)).toFixed(1)} MB exceeds the 5 MB parse cap`,
      );
      return;
    }

    let config: unknown;
    try {
      const raw = await this.fileSystem.readFile(filePath);
      config = JSON.parse(raw);
    } catch {
      this.logger.warn(
        `MCPToolRegistry [${source}]: malformed JSON in ${filePath} — ignoring file`,
      );
      return;
    }
    if (!config || typeof config !== "object") return;

    const record = config as Record<string, unknown>;
    const servers =
      (record.servers as Record<string, RawServerConfig> | undefined) ??
      (record.mcpServers as Record<string, RawServerConfig> | undefined) ??
      {};
    const disabled = source.startsWith("vscode")
      ? this.envProvider.getVsCodeDisabledServers()
      : new Set<string>();
    this.registerServers(
      state,
      servers,
      (name) => !disabled.has(name),
      source,
    );
  }

  /**
   * Register servers from a parsed server map into the discovery state.
   * `isEnabled` applies source-specific checks (VS Code disabled list).
   * First source wins; later sources are recorded on the descriptor and a
   * conflict warning is emitted when the normalized command+args differ.
   */
  private registerServers(
    state: DiscoveryState,
    servers: Record<string, RawServerConfig>,
    isEnabled: (name: string) => boolean,
    source: McpConfigSource,
  ): void {
    for (const [name, cfg] of Object.entries(servers ?? {})) {
      if (!cfg || typeof cfg !== "object") continue;

      const existing = state.servers.get(name);
      if (existing) {
        // First source wins for tools/visibility; record the extra source.
        existing.sources.push(source);
        for (const descriptor of existing.descriptors) {
          descriptor.sources.push(source);
        }
        const signature = this.commandSignature(cfg);
        if (
          signature &&
          existing.commandSignature &&
          existing.commandSignature !== signature
        ) {
          this.logger.warn(
            `MCPToolRegistry: server "${name}" is declared with different ` +
              `commands in [${existing.sources[0]}] and [${source}] — ` +
              `keeping [${existing.sources[0]}]`,
          );
        }
        continue;
      }

      const enabled =
        isEnabled(name) &&
        cfg.disabled !== true &&
        typeof cfg.command === "string" &&
        cfg.command.trim() !== "";

      const registered: RegisteredServer = {
        sources: [source],
        commandSignature: this.commandSignature(cfg),
        enabled,
        config: cfg,
        descriptors: [],
      };
      state.servers.set(name, registered);

      if (!enabled) {
        this.logger.log(
          `MCPToolRegistry [${source}]: server "${name}" is disabled or has no command — skipping`,
        );
      }

      if (Array.isArray(cfg.tools)) {
        for (const tool of cfg.tools) {
          if (!tool || typeof tool.name !== "string" || tool.name === "") continue;
          const descriptor: MCPToolDescriptor = {
            serverName: name,
            toolName: tool.name,
            qualifiedName: `${name}.${tool.name}`,
            description: tool.description ?? "",
            inputSummary: this.summarizeInput(tool.inputSchema),
            enabled,
            source,
            sources: [source],
            visibility: visibilityFor(source),
            origin: "inline-schema",
          };
          registered.descriptors.push(descriptor);
          state.catalog.push(descriptor);
        }
      } else if (enabled) {
        // No inline tool schema — name-level stub only (not injectable).
        this.logger.log(
          `MCPToolRegistry [${source}]: server "${name}" has no inline tool schemas; stub registered`,
        );
      }
    }
  }

  /** Normalized `command + args` used for dedup-conflict detection. */
  private commandSignature(cfg: RawServerConfig): string {
    const command = typeof cfg.command === "string" ? cfg.command.trim() : "";
    const args = Array.isArray(cfg.args)
      ? cfg.args.map((a) => String(a).trim())
      : [];
    return `${command} ${JSON.stringify(args)}`;
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
