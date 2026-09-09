/**
 * RefreshMcpIndexCommand — `promptBooster.refreshMcpIndex`.
 *
 * Rebuilds the MCP tool catalog and persists real tool knowledge into the
 * user-editable manual index (`.vscode/promptbooster-mcp-tools.json`):
 *   1. runtime tools (vscode.lm.tools) are always collected;
 *   2. when `promptBooster.mcp.probeServers` is enabled, servers without
 *      known tools are probed (opt-in, hard-timeboxed, cached 24h);
 *   3. existing manual entries not covered by fresh results are preserved
 *      (user edits survive; refresh wins per (server, tool)).
 *
 * Never runs on the enhance path — this is an explicit user action.
 */
import * as vscode from "vscode";
import { MCPToolRegistry } from "../../core/services/MCPToolRegistry";
import { IMcpServerProbe } from "../../core/services/IMcpServerProbe";
import {
  IMcpToolIndexStore,
  ManualIndexEntry,
} from "../../core/services/IMcpToolIndexStore";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";

export class RefreshMcpIndexCommand {
  /** Bound the worst-case runtime (each probe is timeboxed to ~6s). */
  private static readonly MAX_PROBE_TARGETS = 10;

  constructor(
    private registry: MCPToolRegistry,
    private probe: IMcpServerProbe,
    private indexStore: IMcpToolIndexStore,
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {}

  async execute(): Promise<void> {
    this.logger.log("RefreshMcpIndexCommand: execute");
    try {
      const { toolCount, probedServers } = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "PromptBooster: refreshing MCP tool index",
          cancellable: false,
        },
        () => this.refresh(),
      );
      const hint = this.configManager.getMcpProvisioningOptions().probeServers
        ? ""
        : " (enable promptBooster.mcp.probeServers to also probe configured servers)";
      vscode.window.showInformationMessage(
        `PromptBooster: MCP tool index refreshed — ${toolCount} tools from ` +
          `${probedServers} probed server(s)${hint}`,
      );
    } catch (error) {
      this.logger.error("RefreshMcpIndexCommand failed", error as Error);
      vscode.window.showErrorMessage(
        `Failed to refresh MCP index: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async refresh(): Promise<{ toolCount: number; probedServers: number }> {
    // Fresh discovery so runtime results and probe targets are current.
    await this.registry.discover();

    const entries: ManualIndexEntry[] = [];

    // 1. Runtime tools (primary source — always collected when available).
    for (const tool of this.registry.getToolCatalog()) {
      if (tool.origin !== "runtime-api") continue;
      entries.push({
        server: tool.serverName,
        name: tool.toolName,
        description: tool.description,
        ...(tool.inputSummary ? { inputSummary: tool.inputSummary } : {}),
      });
    }
    const runtimeCount = entries.length;

    // 2. Opt-in probes for servers whose tools are still unknown.
    let probedServers = 0;
    if (this.configManager.getMcpProvisioningOptions().probeServers) {
      const targets = this.registry
        .getProbeTargets()
        .slice(0, RefreshMcpIndexCommand.MAX_PROBE_TARGETS);
      for (const target of targets) {
        const result = await this.probe.listServerTools(target);
        await this.indexStore.setProbeCache(target.command, target.args, result.tools);
        if (result.tools.length === 0) continue;
        probedServers++;
        for (const tool of result.tools) {
          entries.push({
            server: target.serverName,
            name: tool.name,
            description: tool.description ?? "",
          });
        }
      }
    }

    // 3. Preserve user-curated entries not covered by fresh results.
    const covered = new Set(entries.map((e) => `${e.server}.${e.name}`));
    const existing = await this.indexStore.loadManualIndex();
    let preserved = 0;
    for (const entry of existing) {
      if (covered.has(`${entry.server}.${entry.name}`)) continue;
      entries.push(entry);
      preserved++;
    }

    // Stable ordering keeps the file diff-friendly.
    entries.sort((a, b) =>
      `${a.server}.${a.name}` < `${b.server}.${b.name}` ? -1 : 1,
    );
    await this.indexStore.saveManualIndex(entries);

    // Re-run discovery so the just-written index + cache are live immediately
    // (also refreshes the fingerprint so ensureCatalog serves fresh data).
    await this.registry.discover();

    this.logger.log(
      `RefreshMcpIndexCommand: wrote ${entries.length} tools ` +
        `(${runtimeCount} runtime, ${probedServers} probed servers, ` +
        `${preserved} manual entries preserved)`,
    );
    return { toolCount: entries.length, probedServers };
  }

  register(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "promptBooster.refreshMcpIndex",
      () => this.execute(),
    );
    context.subscriptions.push(disposable);
  }
}
