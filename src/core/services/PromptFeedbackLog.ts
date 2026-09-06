/**
 * PromptFeedbackLog (Phase E1)
 *
 * Records explicit user decisions about rendered prompt enhancements, replacing
 * the withdrawn McpEffectivenessLog design. The chat UI's existing buttons are
 * the ground truth: Apply/Ask in Chat = verbatim accept (weak positive),
 * Use Original = reject, Refine in File / Edit = edit path (edit-opened,
 * later upgraded to edit-finalized by UsePromptVersionCommand).
 *
 * Record lifecycle:
 *   pending ──▶ accept | reject | edit-opened ──▶ edit-finalized
 *   (accept/reject are terminal; edit-opened upgrades exactly once)
 *
 * Storage: workspace state via IStateRepository — never a committable file
 * (prompts may contain secrets). Pending records persist so edit-finalized
 * still resolves after a window reload; they expire lazily after
 * PENDING_TTL_MS. Resolved records live in a ring buffer capped at
 * `promptBooster.feedback.historyLimit`.
 *
 * Failure posture: every state read/write is guarded — a throwing repository
 * degrades to in-memory-only operation (or empty aggregates) and is logged,
 * never propagated across the enhance path.
 */
import { randomUUID } from "crypto";
import { IStateRepository } from "../../infrastructure/state/StateRepository";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";
import {
  ConfirmedPromptPair,
  McpRefLabel,
  PromptFeedbackOutcome,
  PromptFeedbackRecord,
} from "../../shared/types/PromptFeedbackTypes";

/** Workspace-state keys (namespaced, single concern each). */
const PENDING_KEY = "promptbooster.feedback.pending";
const RESOLVED_KEY = "promptbooster.feedback.resolved";

/** Pending records older than this are lazily dropped (7 days). */
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Input for a pending record created at render time. */
export interface PendingFeedbackInput {
  rawPrompt: string;
  enhancedPrompt: string;
  intent: "ask" | "edit";
  /** Built-in tool tags injected at enhance time (Enhancement 1). */
  builtinToolTags: string[];
  /** MCP qualifiedNames ("server.tool") injected at enhance time. */
  mcpRefs: string[];
  /** Registry catalog fingerprint at enhance time. */
  catalogFingerprint: string;
  /** Best-effort feature-detected request.toolCalls, when available. */
  observedToolCalls?: string[];
}

/** Aggregated outcome funnel + derived rates for showFeedbackReport. */
export interface PromptFeedbackReport {
  /** Currently pending (rendered, decision not yet observed). */
  pending: number;
  funnel: {
    accept: number;
    reject: number;
    "edit-opened": number;
    "edit-finalized": number;
  };
  /** accept / (accept + reject); null when no accept/reject decisions yet. */
  acceptanceRate: number | null;
  /** retained / (retained + removed) over edit-finalized records; null when none. */
  retentionRate: number | null;
  /** retained-strong label count over edit-finalized records. */
  retainedRefs: number;
  /** removed label count over edit-finalized records. */
  removedRefs: number;
  /** Records carrying at least one observed tool call (best-effort side channel). */
  observedToolCallRecords: number;
  /** Fraction of observed calls matching an injected ref; null when no observations. */
  observedToolCallPrecision: number | null;
}

/** Core service interface (repo convention: defined alongside the service). */
export interface IPromptFeedbackLog {
  createPending(input: PendingFeedbackInput): string | undefined;
  resolve(
    feedbackId: string,
    outcome: Extract<PromptFeedbackOutcome, "accept" | "reject" | "edit-opened">,
  ): void;
  finalizeEdit(feedbackId: string, finalText: string): void;
  getConfirmedPositives(): ConfirmedPromptPair[];
  getReport(): PromptFeedbackReport;
}

// ─── Pure prompt-file helpers (used by UsePromptVersionCommand) ───────────────

/** Matches `PromptBooster-Feedback-Id: <id>` exactly (one line, no spaces in id). */
export const FEEDBACK_ID_PATTERN = /^PromptBooster-Feedback-Id:\s*(\S+)\s*$/m;

/**
 * Extract the feedback id from a generated prompt file's LEADING HTML comment
 * block. Ids elsewhere in the document are ignored (only FileModeStrategy's
 * header is authoritative).
 */
export function extractFeedbackId(content: string): string | undefined {
  if (!content.startsWith("<!--")) return undefined;
  const end = content.indexOf("-->");
  if (end === -1) return undefined;
  return FEEDBACK_ID_PATTERN.exec(content.slice(0, end))?.[1];
}

/**
 * Strip HTML comments — the IDENTICAL rule FileModeStrategy.processPromptFile
 * applies, shared so "Use This Version" finalizes with exactly the text
 * "Process" would send.
 */
export function stripHtmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/**
 * Derive per-injected-ref labels for a record (pure — unit-tested as written):
 *
 * | outcome        | label per injected ref                                        |
 * |----------------|---------------------------------------------------------------|
 * | edit-finalized | retained-strong iff finalText contains the qualifiedName OR   |
 * |                | both serverName and toolName; else removed                     |
 * | accept         | retained-weak (prompt-level signal; per-ref unknowable)        |
 * | reject         | removed                                                        |
 * | pending /      | none (funnel-only)                                             |
 * | edit-opened    |                                                                |
 */
export function deriveRefLabels(
  record: PromptFeedbackRecord,
): Array<{ ref: string; label: McpRefLabel }> {
  if (record.outcome === "edit-finalized") {
    const text = record.finalText ?? "";
    return record.mcpRefs.map((ref) => {
      const dot = ref.indexOf(".");
      const serverName = dot > 0 ? ref.slice(0, dot) : ref;
      const toolName = dot > 0 ? ref.slice(dot + 1) : ref;
      const retained =
        text.includes(ref) ||
        (toolName !== "" && text.includes(serverName) && text.includes(toolName));
      return { ref, label: retained ? "retained-strong" : "removed" };
    });
  }
  if (record.outcome === "accept") {
    return record.mcpRefs.map((ref) => ({ ref, label: "retained-weak" }));
  }
  if (record.outcome === "reject") {
    return record.mcpRefs.map((ref) => ({ ref, label: "removed" }));
  }
  return [];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PromptFeedbackLog implements IPromptFeedbackLog {
  private pending = new Map<string, PromptFeedbackRecord>();
  private resolved: PromptFeedbackRecord[] = [];
  private loaded = false;

  constructor(
    private state: IStateRepository,
    private configManager: IConfigurationManager,
    private logger: ILogger,
  ) {}

  /** Create a pending record at render time; returns the id (undefined when disabled). */
  createPending(input: PendingFeedbackInput): string | undefined {
    try {
      if (!this.configManager.getFeedbackLearningOptions().feedbackEnabled) {
        return undefined;
      }
      this.ensureLoaded();
      const feedbackId = randomUUID();
      const record: PromptFeedbackRecord = {
        feedbackId,
        rawPrompt: input.rawPrompt,
        enhancedPrompt: input.enhancedPrompt,
        intent: input.intent,
        builtinToolTags: [...input.builtinToolTags],
        mcpRefs: [...input.mcpRefs],
        outcome: "pending",
        catalogFingerprint: input.catalogFingerprint,
        timestamp: Date.now(),
        ...(input.observedToolCalls?.length
          ? { observedToolCalls: [...input.observedToolCalls] }
          : {}),
      };
      this.pending.set(feedbackId, record);
      this.persistPending();
      return feedbackId;
    } catch (error) {
      // Capture must never break the enhance path.
      this.logger.warn(
        `PromptFeedbackLog: createPending failed (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return undefined;
    }
  }

  /** Move a pending record to a decision outcome. Unknown/expired ids: no-op. */
  resolve(
    feedbackId: string,
    outcome: "accept" | "reject" | "edit-opened",
  ): void {
    try {
      this.ensureLoaded();
      const record = this.pending.get(feedbackId);
      if (!record) return;
      this.pending.delete(feedbackId);
      record.outcome = outcome;
      this.appendResolved(record);
      this.persistPending();
      this.persistResolved();
    } catch (error) {
      this.logger.warn(
        `PromptFeedbackLog: resolve(${outcome}) failed for ${feedbackId} (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  /** Upgrade an edit-opened record with the user's final edited text. */
  finalizeEdit(feedbackId: string, finalText: string): void {
    try {
      this.ensureLoaded();
      const record = this.resolved.find((r) => r.feedbackId === feedbackId);
      if (!record || record.outcome !== "edit-opened") return;
      record.outcome = "edit-finalized";
      record.finalText = finalText;
      this.persistResolved();
    } catch (error) {
      this.logger.warn(
        `PromptFeedbackLog: finalizeEdit failed for ${feedbackId} (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  /**
   * Confirmed-positive pairs eligible for promotion: verbatim accepts (all
   * injected refs, weak) and edit-finalized records (retained subset, strong).
   * Rejections and unresolved records are NEVER included. Most recent first.
   */
  getConfirmedPositives(): ConfirmedPromptPair[] {
    try {
      this.ensureLoaded();
      return this.resolved
        .filter(
          (r) => r.outcome === "accept" || r.outcome === "edit-finalized",
        )
        .map((r) => ({
          rawPrompt: r.rawPrompt,
          enhancedPrompt:
            r.outcome === "edit-finalized" && r.finalText !== undefined
              ? r.finalText
              : r.enhancedPrompt,
          retainedRefs:
            r.outcome === "accept"
              ? [...r.mcpRefs]
              : deriveRefLabels(r)
                  .filter((l) => l.label === "retained-strong")
                  .map((l) => l.ref),
          timestamp: r.timestamp,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      this.logger.warn(
        `PromptFeedbackLog: getConfirmedPositives failed (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return [];
    }
  }

  /** Aggregated funnel + rates for promptBooster.showFeedbackReport. */
  getReport(): PromptFeedbackReport {
    try {
      this.ensureLoaded();
      const funnel = { accept: 0, reject: 0, "edit-opened": 0, "edit-finalized": 0 };
      for (const r of this.resolved) {
        if (r.outcome !== "pending" && r.outcome in funnel) funnel[r.outcome]++;
      }
      const acceptanceDenominator = funnel.accept + funnel.reject;
      const acceptanceRate =
        acceptanceDenominator > 0
          ? funnel.accept / acceptanceDenominator
          : null;

      let retainedRefs = 0;
      let removedRefs = 0;
      for (const r of this.resolved) {
        if (r.outcome !== "edit-finalized") continue;
        for (const { label } of deriveRefLabels(r)) {
          if (label === "retained-strong") retainedRefs++;
          else if (label === "removed") removedRefs++;
        }
      }
      const retentionDenominator = retainedRefs + removedRefs;
      const retentionRate =
        retentionDenominator > 0 ? retainedRefs / retentionDenominator : null;

      // Best-effort observed-toolCalls precision (feature-detected side channel).
      let observedRecords = 0;
      let observedCalls = 0;
      let observedMatched = 0;
      for (const r of this.resolved) {
        const calls = r.observedToolCalls;
        if (!calls || calls.length === 0) continue;
        observedRecords++;
        for (const call of calls) {
          observedCalls++;
          // Best-effort: matches the qualified ref or its tool name (runtime
          // IDs such as `mcp_server_tool` embed the tool name).
          const matched = r.mcpRefs.some((ref) => {
            if (call === ref || call.includes(ref)) return true;
            const toolName = ref.split(".").pop() ?? "";
            return toolName !== "" && call.includes(toolName);
          });
          if (matched) observedMatched++;
        }
      }

      return {
        pending: this.pending.size,
        funnel,
        acceptanceRate,
        retentionRate,
        retainedRefs,
        removedRefs,
        observedToolCallRecords: observedRecords,
        observedToolCallPrecision:
          observedCalls > 0 ? observedMatched / observedCalls : null,
      };
    } catch (error) {
      this.logger.warn(
        `PromptFeedbackLog: getReport failed (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return {
        pending: 0,
        funnel: { accept: 0, reject: 0, "edit-opened": 0, "edit-finalized": 0 },
        acceptanceRate: null,
        retentionRate: null,
        retainedRefs: 0,
        removedRefs: 0,
        observedToolCallRecords: 0,
        observedToolCallPrecision: null,
      };
    }
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  /** Lazily load (and TTL-prune) persisted records; failure ⇒ empty state. */
  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const pendingList = this.readRecords(PENDING_KEY);
      const cutoff = Date.now() - PENDING_TTL_MS;
      for (const record of pendingList) {
        if (record.outcome === "pending" && record.timestamp >= cutoff) {
          this.pending.set(record.feedbackId, record);
        }
      }
      this.resolved = this.readRecords(RESOLVED_KEY).filter(
        (r) => r.outcome !== "pending",
      );
    } catch (error) {
      this.logger.warn(
        `PromptFeedbackLog: state load failed — starting empty (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  /** Read + defensively validate a record list; corrupt payload ⇒ empty. */
  private readRecords(key: string): PromptFeedbackRecord[] {
    const raw = this.state.getWorkspace<unknown>(key);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is PromptFeedbackRecord =>
        !!r &&
        typeof r === "object" &&
        typeof (r as PromptFeedbackRecord).feedbackId === "string" &&
        typeof (r as PromptFeedbackRecord).outcome === "string",
    );
  }

  private appendResolved(record: PromptFeedbackRecord): void {
    const limit = this.configManager.getFeedbackLearningOptions().historyLimit;
    this.resolved.push(record);
    if (this.resolved.length > limit) {
      this.resolved.splice(0, this.resolved.length - limit); // drop oldest
    }
  }

  /** Fire-and-forget persistence — logged on failure, never thrown. */
  private persistPending(): void {
    void Promise.resolve()
      .then(() =>
        this.state.setWorkspace(PENDING_KEY, [...this.pending.values()]),
      )
      .catch((error) => this.logPersistFailure("pending", error));
  }

  private persistResolved(): void {
    void Promise.resolve()
      .then(() => this.state.setWorkspace(RESOLVED_KEY, this.resolved))
      .catch((error) => this.logPersistFailure("resolved", error));
  }

  private logPersistFailure(what: string, error: unknown): void {
    this.logger.warn(
      `PromptFeedbackLog: persisting ${what} records failed (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
}
