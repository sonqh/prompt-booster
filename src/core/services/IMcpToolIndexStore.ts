/**
 * Interface for McpToolIndexStore — defined alongside the service per repo
 * convention (cf. IPromptOptimizationService).
 */
import { McpProbeTool } from "../../shared/interfaces/IMcpProcessTransport";

/** One user-editable entry of the manual tool index file. */
export interface ManualIndexEntry {
  /** MCP server name (semantic identifier, e.g. "postgres-mcp"). */
  server: string;
  /** Tool name as the server reports it (e.g. "query_db"). */
  name: string;
  description?: string;
  inputSummary?: string;
}

export interface IMcpToolIndexStore {
  /** Absolute path of the manual index file (for fingerprinting). */
  getManualIndexPath(): string;

  /**
   * Load the manual index (`.vscode/promptbooster-mcp-tools.json`).
   * Defensive: absent file → []; malformed JSON → warn + []; wrong-shaped
   * entries are filtered. Never throws.
   */
  loadManualIndex(): Promise<ManualIndexEntry[]>;

  /** Persist the manual index (pretty-printed, user-editable). Never throws. */
  saveManualIndex(entries: ManualIndexEntry[]): Promise<void>;

  /**
   * Probe cache lookup keyed by the server's normalized `command+args`.
   * Resolves undefined on miss (absent, fingerprint mismatch, 24h TTL
   * expiry, or corrupt state). Never throws.
   */
  getProbeCache(command: string, args?: string[]): Promise<McpProbeTool[] | undefined>;

  /** Store a probe result. Best-effort; failures are logged, not thrown. */
  setProbeCache(
    command: string,
    args: string[] | undefined,
    tools: McpProbeTool[],
  ): Promise<void>;

  /**
   * Opaque stamp of the probe-cache contents (changes whenever an entry is
   * written or expires) — included by the registry in its fingerprint.
   */
  getCacheStamp(): string;
}
