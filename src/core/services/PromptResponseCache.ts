/**
 * PromptResponseCache (Phase E2)
 *
 * Caches ONLY the optimizer LLM output, keyed by:
 *   sha256([
 *     "pb-cache-v1",                    // key-schema version
 *     normalizeWhitespace(rawPrompt),   // trim + collapse \s+; NOT lowercased
 *     catalogFingerprint,               // registry v2 fingerprint
 *     OPTIMIZER_PROMPT_VERSION,         // bumped on any optimizer-prompt change
 *     fewShotStamp,                     // "" when few-shot is off
 *   ].join(NUL))
 *
 * Everything deterministic (workspace preamble, reference resolution,
 * classification, current-catalog filtering) re-runs on every request — a hit
 * skips exactly one LLM round-trip. The cache sits immediately in front of the
 * optimizer call inside the strategy's existing timeout race.
 *
 * Storage: workspace state via IStateRepository (never a committable file —
 * prompts may contain secrets), ordered entry list with LRU eviction at
 * `promptBooster.cache.maxEntries` and lazy TTL expiry at
 * `promptBooster.cache.ttlDays`.
 *
 * Failure posture: get() never throws; put() is fire-and-forget with a logged
 * catch; corrupt state ⇒ treated as empty (miss); disabled ⇒ always miss and
 * put is a no-op. Cache behavior must never be observable as an enhance
 * failure.
 */
import { createHash } from "crypto";
import { IStateRepository } from "../../infrastructure/state/StateRepository";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";
import { CachedPromptResponse } from "../../shared/types/PromptFeedbackTypes";
import { OPTIMIZER_PROMPT_VERSION } from "../prompts/SystemPrompts";

const ENTRIES_KEY = "promptbooster.responseCache.entries";
const STATS_KEY = "promptbooster.responseCache.stats";

/** Bump when the key formula itself changes (invalidates every entry). */
const KEY_SCHEMA_VERSION = "pb-cache-v1";

const DAY_MS = 24 * 60 * 60 * 1000;

/** trim + collapse whitespace runs to single spaces; deliberately not lowercased. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The cache key formula (pure, exported for tests). `optimizerPromptVersion`
 * defaults to the current OPTIMIZER_PROMPT_VERSION — the parameter exists so
 * tests can prove a version bump invalidates keys.
 */
export function computeResponseCacheKey(
  rawPrompt: string,
  catalogFingerprint: string,
  fewShotStamp: string,
  optimizerPromptVersion: string = OPTIMIZER_PROMPT_VERSION,
): string {
  return createHash("sha256")
    .update(
      [
        KEY_SCHEMA_VERSION,
        normalizeWhitespace(rawPrompt),
        catalogFingerprint,
        optimizerPromptVersion,
        fewShotStamp,
      ].join(String.fromCharCode(0)), // NUL: cannot occur in normalized text
    )
    .digest("hex");
}

interface CacheEntry {
  key: string;
  response: CachedPromptResponse;
}

interface CacheStats {
  hits: number;
  misses: number;
}

/** Core service interface (repo convention: defined alongside the service). */
export interface IPromptResponseCache {
  computeKey(
    rawPrompt: string,
    catalogFingerprint: string,
    fewShotStamp: string,
  ): string;
  get(key: string): Promise<CachedPromptResponse | undefined>;
  put(key: string, enhancedPrompt: string, intent: "ask" | "edit"): void;
  getCacheStats(): { hits: number; misses: number; hitRate: number | null };
}

export class PromptResponseCache implements IPromptResponseCache {
  /** Ordered entries: most recently used last (LRU eviction from the front). */
  private entries: CacheEntry[] = [];
  private stats: CacheStats = { hits: 0, misses: 0 };
  private loaded = false;

  constructor(
    private state: IStateRepository,
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {}

  computeKey(
    rawPrompt: string,
    catalogFingerprint: string,
    fewShotStamp: string,
  ): string {
    return computeResponseCacheKey(rawPrompt, catalogFingerprint, fewShotStamp);
  }

  /** Look up a cached optimizer response; never throws. */
  async get(key: string): Promise<CachedPromptResponse | undefined> {
    try {
      const options = this.configManager.getFeedbackLearningOptions();
      if (!options.cacheEnabled) return undefined;
      this.ensureLoaded();

      const index = this.entries.findIndex((e) => e.key === key);
      if (index === -1) {
        this.recordMiss();
        return undefined;
      }

      const entry = this.entries[index];
      if (Date.now() - entry.response.createdAt > options.cacheTtlDays * DAY_MS) {
        // Lazily expired — drop and report a miss.
        this.entries.splice(index, 1);
        this.persistEntries();
        this.recordMiss();
        return undefined;
      }

      // Hit: refresh LRU position and inflate hitCount (hit-rate metric).
      // createdAt stays as-is — it anchors entry creation, not last use.
      entry.response.hitCount++;
      this.entries.splice(index, 1);
      this.entries.push(entry);
      this.stats.hits++;
      this.persistEntries();
      this.persistStats();
      return { ...entry.response };
    } catch (error) {
      this.logger.warn(
        `PromptResponseCache: get failed — treating as miss (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return undefined;
    }
  }

  /** Store an optimizer response; fire-and-forget, no-op when disabled. */
  put(key: string, enhancedPrompt: string, intent: "ask" | "edit"): void {
    try {
      const options = this.configManager.getFeedbackLearningOptions();
      if (!options.cacheEnabled) return;
      this.ensureLoaded();

      const existing = this.entries.find((e) => e.key === key);
      if (existing) {
        existing.response = {
          enhancedPrompt,
          intent,
          createdAt: Date.now(),
          hitCount: existing.response.hitCount,
        };
        // Move to most-recently-used position.
        this.entries = this.entries.filter((e) => e.key !== key);
        this.entries.push(existing);
      } else {
        this.entries.push({
          key,
          response: { enhancedPrompt, intent, createdAt: Date.now(), hitCount: 0 },
        });
      }

      // LRU eviction at the cap.
      while (this.entries.length > options.cacheMaxEntries) {
        this.entries.shift();
      }

      this.persistEntries();
    } catch (error) {
      this.logger.warn(
        `PromptResponseCache: put failed — cached path degraded to a miss (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  /** Hit-rate metric for the feedback report. */
  getCacheStats(): { hits: number; misses: number; hitRate: number | null } {
    try {
      this.ensureLoaded();
      const total = this.stats.hits + this.stats.misses;
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: total > 0 ? this.stats.hits / total : null,
      };
    } catch {
      return { hits: 0, misses: 0, hitRate: null };
    }
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  /**
   * Defensive shape check for persisted entries — a non-numeric `createdAt`
   * would make the TTL comparison NaN (never expiring) and a wrong `intent`
   * would flow into PromptResult, so anything malformed is dropped (miss).
   */
  private isValidResponse(response: unknown): response is CachedPromptResponse {
    if (!response || typeof response !== "object") return false;
    const r = response as CachedPromptResponse;
    return (
      typeof r.enhancedPrompt === "string" &&
      (r.intent === "ask" || r.intent === "edit") &&
      typeof r.createdAt === "number" &&
      typeof r.hitCount === "number"
    );
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const rawEntries = this.state.getWorkspace<unknown>(ENTRIES_KEY);
      if (Array.isArray(rawEntries)) {
        this.entries = rawEntries.filter(
          (e): e is CacheEntry =>
            !!e &&
            typeof e === "object" &&
            typeof (e as CacheEntry).key === "string" &&
            this.isValidResponse((e as CacheEntry).response),
        );
      }
      const rawStats = this.state.getWorkspace<unknown>(STATS_KEY);
      if (
        rawStats &&
        typeof rawStats === "object" &&
        typeof (rawStats as CacheStats).hits === "number" &&
        typeof (rawStats as CacheStats).misses === "number"
      ) {
        this.stats = {
          hits: (rawStats as CacheStats).hits,
          misses: (rawStats as CacheStats).misses,
        };
      }
    } catch (error) {
      this.logger.warn(
        `PromptResponseCache: state load failed — starting empty (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  private recordMiss(): void {
    this.stats.misses++;
    this.persistStats();
  }

  private persistEntries(): void {
    void this.state
      .setWorkspace(ENTRIES_KEY, this.entries)
      .catch((error) => this.logPersistFailure("entries", error));
  }

  private persistStats(): void {
    void this.state
      .setWorkspace(STATS_KEY, this.stats)
      .catch((error) => this.logPersistFailure("stats", error));
  }

  private logPersistFailure(what: string, error: unknown): void {
    this.logger.warn(
      `PromptResponseCache: persisting ${what} failed (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
}
