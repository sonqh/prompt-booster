/**
 * McpToolIndexStore — persistence for Enhancement 4 v2 tool acquisition.
 *
 * Two artifacts:
 *   1. The MANUAL INDEX — `.vscode/promptbooster-mcp-tools.json`, written by
 *      the refresh command (runtime + probe results merged) and freely
 *      editable by the user (fix descriptions, delete noise, commit it).
 *   2. The PROBE CACHE — workspace state (never a committable file) keyed by
 *      the server's normalized `command+args` with a 24h TTL, so repeated
 *      refreshes don't re-spawn servers unnecessarily.
 *
 * Everything is defensive: malformed input degrades to empty/default and is
 * logged, never thrown.
 */
import * as path from "path";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import { ILogger } from "../../shared/interfaces/ILogger";
import { McpProbeTool } from "../../shared/interfaces/IMcpProcessTransport";
import type { IStateRepository } from "../../infrastructure/state/StateRepository";
import {
  IMcpToolIndexStore,
  ManualIndexEntry,
} from "./IMcpToolIndexStore";

/** Workspace-state key for the probe cache (namespaced). */
export const PROBE_CACHE_STATE_KEY = "promptbooster.mcp.probeCache";

interface ProbeCacheEntry {
  tools: McpProbeTool[];
  cachedAt: number;
}

type ProbeCacheState = Record<string, ProbeCacheEntry>;

/** Bound retention: at most 64 server entries in workspace state. */
const PROBE_CACHE_MAX_ENTRIES = 64;

/**
 * Normalized `command+args` fingerprint used as the probe-cache key.
 * Exported for tests and for anyone inspecting cache state.
 */
export function probeCacheFingerprint(
  command: string,
  args?: string[],
): string {
  const normalizedCommand = String(command ?? "").trim();
  const normalizedArgs = (args ?? []).map((a) => String(a).trim());
  return JSON.stringify([normalizedCommand, normalizedArgs]);
}

export class McpToolIndexStore implements IMcpToolIndexStore {
  private static readonly PROBE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private fileSystem: IFileSystem,
    private stateRepository: IStateRepository,
    private logger: ILogger,
  ) {}

  getManualIndexPath(): string {
    const ws = this.fileSystem.getWorkspacePath() ?? process.cwd();
    return path.join(ws, ".vscode", "promptbooster-mcp-tools.json");
  }

  async loadManualIndex(): Promise<ManualIndexEntry[]> {
    const indexPath = this.getManualIndexPath();

    // Absent file → empty (stat contract: undefined when missing; also
    // tolerate readFile implementations that resolve "" instead of throwing).
    let stat: { mtimeMs: number; size: number } | undefined;
    try {
      stat = await this.fileSystem.stat(indexPath);
    } catch {
      /* fall through to readFile */
    }
    if (stat === undefined) return [];

    let raw: string;
    try {
      raw = await this.fileSystem.readFile(indexPath);
    } catch {
      return [];
    }
    if (!raw.trim()) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(
        `McpToolIndexStore: malformed JSON in ${indexPath} — ignoring file`,
      );
      return [];
    }

    if (!parsed || typeof parsed !== "object") return [];
    const tools = (parsed as Record<string, unknown>).tools;
    if (!Array.isArray(tools)) return [];

    const entries: ManualIndexEntry[] = [];
    for (const entry of tools) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      if (typeof record.server !== "string" || record.server === "") continue;
      if (typeof record.name !== "string" || record.name === "") continue;
      // Optional keys are only included when present (deep-equal friendly).
      entries.push({
        server: record.server,
        name: record.name,
        ...(typeof record.description === "string"
          ? { description: record.description }
          : {}),
        ...(typeof record.inputSummary === "string"
          ? { inputSummary: record.inputSummary }
          : {}),
      });
    }
    return entries;
  }

  async saveManualIndex(entries: ManualIndexEntry[]): Promise<void> {
    const indexPath = this.getManualIndexPath();
    try {
      await this.fileSystem.createDirectory(path.dirname(indexPath));
      const payload = {
        // Editor-friendly header; the shape is { tools: [...] }.
        tools: entries.map((e) => ({
          server: e.server,
          name: e.name,
          ...(e.description !== undefined ? { description: e.description } : {}),
          ...(e.inputSummary !== undefined ? { inputSummary: e.inputSummary } : {}),
        })),
      };
      await this.fileSystem.writeFile(
        indexPath,
        JSON.stringify(payload, null, 2) + "\n",
      );
    } catch (error) {
      this.logger.error(
        `McpToolIndexStore: failed to write ${indexPath}`,
        error as Error,
      );
    }
  }

  async getProbeCache(
    command: string,
    args?: string[],
  ): Promise<McpProbeTool[] | undefined> {
    const state = this.readCacheState();
    const entry = state[probeCacheFingerprint(command, args)];
    if (!entry || typeof entry.cachedAt !== "number") return undefined;
    if (
      !Array.isArray(entry.tools) ||
      Date.now() - entry.cachedAt > McpToolIndexStore.PROBE_CACHE_TTL_MS
    ) {
      return undefined; // expired (or corrupt) — caller falls through
    }
    return entry.tools.filter(
      (t) => !!t && typeof t === "object" && typeof t.name === "string",
    );
  }

  async setProbeCache(
    command: string,
    args: string[] | undefined,
    tools: McpProbeTool[],
  ): Promise<void> {
    try {
      const state = this.readCacheState();
      state[probeCacheFingerprint(command, args)] = {
        tools,
        cachedAt: Date.now(),
      };
      this.pruneExpired(state);
      await this.stateRepository.setWorkspace(PROBE_CACHE_STATE_KEY, state);
    } catch (error) {
      this.logger.error(
        "McpToolIndexStore: failed to persist probe cache",
        error as Error,
      );
    }
  }

  getCacheStamp(): string {
    const state = this.readCacheState();
    const keys = Object.keys(state).sort();
    return `cache=${keys.map((k) => `${k}@${state[k].cachedAt}`).join(",")}`;
  }

  /** Read + validate the cache state; corrupt values degrade to {}. */
  private readCacheState(): ProbeCacheState {
    try {
      const raw = this.stateRepository.getWorkspace<unknown>(
        PROBE_CACHE_STATE_KEY,
      );
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      return raw as ProbeCacheState;
    } catch {
      return {};
    }
  }

  /** Drop expired entries and cap the retained count (oldest evicted). */
  private pruneExpired(state: ProbeCacheState): void {
    const now = Date.now();
    for (const [key, entry] of Object.entries(state)) {
      if (
        !entry ||
        typeof entry.cachedAt !== "number" ||
        now - entry.cachedAt > McpToolIndexStore.PROBE_CACHE_TTL_MS
      ) {
        delete state[key];
      }
    }
    const keys = Object.keys(state).sort(
      (a, b) => (state[a].cachedAt ?? 0) - (state[b].cachedAt ?? 0),
    );
    while (keys.length > PROBE_CACHE_MAX_ENTRIES) {
      delete state[keys.shift() as string];
    }
  }
}
