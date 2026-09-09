/**
 * PromptLearningStore (Phase E3)
 *
 * Promotes confirmed-positive feedback into bounded, opt-in few-shot examples
 * and on-demand golden-set candidates:
 *
 *   - confirmed positives = resolved records with outcome `accept` (weak — all
 *     injected refs kept) or `edit-finalized` (strong — retained subset only);
 *     rejections and unresolved records are NEVER promoted;
 *   - `getFewShotExamples()` — most recent pairs first, deduped by normalized
 *     raw prompt (most recent wins), capped by example count and a total
 *     character budget over the rendered block (truncated at example
 *     boundaries, never mid-example). OPT-IN, default OFF: accepted prompts
 *     are re-sent to the model provider, a privacy decision the user must
 *     make explicitly — while disabled, the feedback log is not even consulted;
 *   - `getGoldenSetCandidates()` — confirmed positives with ≥ 1 retained MCP
 *     ref as `{ prompt, expectedTools }` entries for maintainer curation
 *     (a human gate — nothing is auto-promoted into the golden set).
 *
 * Selection is prompt-independent (a recent workspace-level list), so the
 * few-shot stamp — and therefore the response-cache key — changes only when
 * new confirmed feedback arrives.
 *
 * DI note: per the plan's wiring this service receives only the feedback log
 * and a logger (no ConfigurationManager). The `promptBooster.learning.*`
 * settings therefore arrive as an explicit FewShotSelectionOptions parameter
 * supplied by the caller; the no-arg default mirrors the shipped defaults
 * (`fewShotFromFeedback: false` ⇒ no examples).
 *
 * Failure posture: every path is guarded — a throwing feedback log degrades to
 * zero examples / zero candidates and is logged, never propagated.
 */
import { createHash } from "crypto";
import { IPromptFeedbackLog } from "./PromptFeedbackLog";
import { normalizeWhitespace } from "./PromptResponseCache";
import {
  FEWSHOT_BLOCK_TEMPLATE,
  FEWSHOT_EXAMPLE_TEMPLATE,
} from "../prompts/FewShotTemplates";
import { ILogger } from "../../shared/interfaces/ILogger";
import { ConfirmedPromptPair } from "../../shared/types/PromptFeedbackTypes";

/** Options governing few-shot selection (mirrors promptBooster.learning.*). */
export interface FewShotSelectionOptions {
  /** `promptBooster.learning.fewShotFromFeedback` — opt-in master switch. */
  enabled: boolean;
  /** `promptBooster.learning.maxFewShotExamples` — example count cap. */
  maxExamples: number;
  /** `promptBooster.learning.fewShotCharBudget` — rendered-block char budget. */
  charBudget: number;
}

/** Shipped defaults (mirror package.json); used when no options are passed. */
export const DEFAULT_FEWSHOT_SELECTION: FewShotSelectionOptions = {
  enabled: false,
  maxExamples: 5,
  charBudget: 2000,
};

/** A golden-set candidate entry — maintainer-curated, never auto-promoted. */
export interface GoldenSetCandidate {
  prompt: string;
  expectedTools: string[];
}

// ─── Pure rendering / stamping helpers (exported for tests + strategy) ───────

/**
 * Render one example through the core/prompts template. Function-form
 * `replace` so `$`-sequences in prompt text are never treated specially.
 */
export function renderFewShotExample(pair: ConfirmedPromptPair): string {
  return FEWSHOT_EXAMPLE_TEMPLATE.replace(
    "{{raw}}",
    () => pair.rawPrompt,
  ).replace("{{enhanced}}", () => pair.enhancedPrompt);
}

/** Render the full few-shot block; "" when there are no examples. */
export function renderFewShotBlock(examples: ConfirmedPromptPair[]): string {
  if (examples.length === 0) return "";
  return FEWSHOT_BLOCK_TEMPLATE.replace(
    "{{examples}}",
    () => examples.map(renderFewShotExample).join("\n\n"),
  );
}

/**
 * Stable stamp of the selected examples: sha256 over their serialized content
 * — each example as `[rawPrompt, enhancedPrompt]`, in selection order. Same
 * examples ⇒ same stamp; any new/stale feedback ⇒ different stamp, which
 * invalidates response-cache keys. Zero examples ⇒ "" (indistinguishable from
 * few-shot being off, so enabling the feature with no history never
 * invalidates the cache).
 */
export function computeFewShotStamp(examples: ConfirmedPromptPair[]): string {
  if (examples.length === 0) return "";
  return createHash("sha256")
    .update(
      JSON.stringify(examples.map((e) => [e.rawPrompt, e.enhancedPrompt])),
    )
    .digest("hex");
}

/** Core service interface (repo convention: defined alongside the service). */
export interface IPromptLearningStore {
  /**
   * Bounded opt-in few-shot examples (most recent first). Returns [] without
   * touching the feedback log when the opt-in is disabled.
   */
  getFewShotExamples(
    options?: FewShotSelectionOptions,
  ): Promise<ConfirmedPromptPair[]>;
  /** Confirmed positives with ≥ 1 retained MCP ref, for maintainer curation. */
  getGoldenSetCandidates(): Promise<GoldenSetCandidate[]>;
}

export class PromptLearningStore implements IPromptLearningStore {
  constructor(
    private feedbackLog: IPromptFeedbackLog,
    private logger: ILogger,
  ) {}

  /**
   * Select the few-shot list: confirmed positives → dedupe by normalized raw
   * prompt (most recent wins — getConfirmedPositives is most-recent-first) →
   * prefix-truncate at whole-example boundaries so that
   * `renderFewShotBlock(result).length <= options.charBudget` whenever the
   * result is non-empty (the constant header counts toward the budget; an
   * example that would overflow the budget ends selection).
   */
  async getFewShotExamples(
    options: FewShotSelectionOptions = DEFAULT_FEWSHOT_SELECTION,
  ): Promise<ConfirmedPromptPair[]> {
    try {
      // Opt-in, default OFF — while disabled the feedback log is not touched.
      if (!options.enabled) return [];

      const deduped: ConfirmedPromptPair[] = [];
      const seen = new Set<string>();
      for (const pair of this.feedbackLog.getConfirmedPositives()) {
        const key = normalizeWhitespace(pair.rawPrompt);
        if (seen.has(key)) continue; // older duplicate of the same prompt
        seen.add(key);
        deduped.push(pair);
      }

      // Char accounting matches renderFewShotBlock exactly: the template
      // header, plus each rendered example, plus the "\n\n" join separators.
      let chars = FEWSHOT_BLOCK_TEMPLATE.replace("{{examples}}", "").length;
      const selected: ConfirmedPromptPair[] = [];
      for (const pair of deduped) {
        if (selected.length >= options.maxExamples) break;
        const cost =
          renderFewShotExample(pair).length +
          (selected.length > 0 ? "\n\n".length : 0);
        if (chars + cost > options.charBudget) break;
        chars += cost;
        selected.push(pair);
      }
      return selected;
    } catch (error) {
      this.logger.warn(
        `PromptLearningStore: getFewShotExamples failed — no examples (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return [];
    }
  }

  /** Golden-set candidates: confirmed positives keeping ≥ 1 MCP ref. */
  async getGoldenSetCandidates(): Promise<GoldenSetCandidate[]> {
    try {
      return this.feedbackLog
        .getConfirmedPositives()
        .filter((pair) => pair.retainedRefs.length > 0)
        .map((pair) => ({
          prompt: pair.rawPrompt,
          expectedTools: [...pair.retainedRefs],
        }));
    } catch (error) {
      this.logger.warn(
        `PromptLearningStore: getGoldenSetCandidates failed — no candidates (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return [];
    }
  }
}
