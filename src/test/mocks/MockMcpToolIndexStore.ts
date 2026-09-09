/**
 * Mock IMcpToolIndexStore — scripted manual-index + probe-cache state for
 * hermetic registry tests.
 */
import {
  IMcpToolIndexStore,
  ManualIndexEntry,
} from "../../core/services/IMcpToolIndexStore";
import { McpProbeTool } from "../../shared/interfaces/IMcpProcessTransport";

export class MockMcpToolIndexStore implements IMcpToolIndexStore {
  public manualEntries: ManualIndexEntry[] = [];
  public manualLoadShouldWarn = false;
  /** command+args fingerprint → tools */
  public probeCache = new Map<string, McpProbeTool[]>();
  public savedEntries: ManualIndexEntry[] | undefined;
  public cacheStamp = "cache=0";

  getManualIndexPath(): string {
    return "/mock/workspace/.vscode/promptbooster-mcp-tools.json";
  }

  async loadManualIndex(): Promise<ManualIndexEntry[]> {
    return this.manualLoadShouldWarn
      ? []
      : this.manualEntries.map((e) => ({ ...e }));
  }

  async saveManualIndex(entries: ManualIndexEntry[]): Promise<void> {
    this.savedEntries = entries.map((e) => ({ ...e }));
    this.manualEntries = entries.map((e) => ({ ...e }));
  }

  async getProbeCache(
    command: string,
    args?: string[],
  ): Promise<McpProbeTool[] | undefined> {
    const key = JSON.stringify([command.trim(), (args ?? []).map(String)]);
    const tools = this.probeCache.get(key);
    return tools ? tools.map((t) => ({ ...t })) : undefined;
  }

  async setProbeCache(
    command: string,
    args: string[] | undefined,
    tools: McpProbeTool[],
  ): Promise<void> {
    const key = JSON.stringify([command.trim(), (args ?? []).map(String)]);
    this.probeCache.set(key, tools.map((t) => ({ ...t })));
  }

  getCacheStamp(): string {
    return this.cacheStamp;
  }
}
