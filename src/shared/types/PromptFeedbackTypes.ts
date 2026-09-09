/**
 * Canonical prompt-feedback, response-cache, and learning types
 * (Enhancement 4 v2 — Phase E redesign).
 *
 * Shared by PromptFeedbackLog / PromptResponseCache / PromptLearningStore
 * (core services), RealtimeModeStrategy (capture at render time), and the
 * presentation commands that resolve outcomes (ChatCommands,
 * UsePromptVersionCommand, ShowFeedbackReportCommand).
 */

/** How a rendered enhancement was disposed of by the user. */
export type PromptFeedbackOutcome =
  | "pending" // created at render time; no decision observed yet
  | "accept" // Apply to Chat / Ask in Chat — optimized text used verbatim (weak positive)
  | "reject" // Use Original — optimized text discarded (negative)
  | "edit-opened" // Refine in File / Edit — file generated, final text not yet observed
  | "edit-finalized"; // Use This Version — final edited text observed (strongest signal)

/**
 * Per-injected-MCP-ref label, derived by comparing the injected
 * `server.tool` refs against the text the user actually kept.
 */
export type McpRefLabel =
  | "retained-strong" // ref still present in an edit-finalized final text
  | "removed" // ref absent from an edit-finalized text, or wholesale rejection
  | "retained-weak"; // verbatim acceptance — prompt-level signal only, per-ref unknown

/** One feedback record. Pending records persist until resolved or TTL-expired. */
export interface PromptFeedbackRecord {
  /** Opaque id; chat buttons and generated prompt-file headers carry it back. */
  feedbackId: string;
  rawPrompt: string;
  enhancedPrompt: string;
  intent: "ask" | "edit";
  /** Built-in tool tags injected at enhance time (Enhancement 1). */
  builtinToolTags: string[];
  /** MCP qualifiedNames ("server.tool") injected at enhance time. */
  mcpRefs: string[];
  outcome: PromptFeedbackOutcome;
  /** Registry catalog fingerprint at enhance time. */
  catalogFingerprint: string;
  timestamp: number;
  /** Final text after user edits (edit-finalized only). */
  finalText?: string;
  /** Best-effort observed tool calls when the chat API exposes them. */
  observedToolCalls?: string[];
}

/** A confirmed-positive (raw, enhanced) pair eligible for promotion. */
export interface ConfirmedPromptPair {
  rawPrompt: string;
  enhancedPrompt: string;
  /** MCP refs the user kept (all injected refs on verbatim accept). */
  retainedRefs: string[];
  timestamp: number;
}

/** Cached optimizer response — the LLM output only; deterministic stages re-run. */
export interface CachedPromptResponse {
  enhancedPrompt: string;
  intent: "ask" | "edit";
  createdAt: number;
  /** Inflated on hits; feeds the cache hit-rate metric. */
  hitCount: number;
}
