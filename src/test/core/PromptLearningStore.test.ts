/**
 * Tests for PromptLearningStore (Phase E3)
 *
 * Promotion rules (only accept / edit-finalized; rejections and unresolved
 * pendings never), dedupe by normalized raw prompt (most recent wins),
 * example-count + char-budget caps (whole-example truncation), the opt-in
 * gate (off ⇒ zero examples without touching the feedback log), golden-set
 * candidate export shape (retained refs only), and few-shot stamp stability.
 */
import * as assert from "assert";
import {
  PromptLearningStore,
  renderFewShotBlock,
  renderFewShotExample,
  computeFewShotStamp,
  FewShotSelectionOptions,
} from "../../core/services/PromptLearningStore";
import { PromptFeedbackLog } from "../../core/services/PromptFeedbackLog";
import { MockStateRepository } from "../mocks/MockStateRepository";
import { MockConfigurationManager } from "../mocks/MockServices";
import { MockLogger } from "../mocks/MockLogger";
import {
  ConfirmedPromptPair,
  PromptFeedbackRecord,
} from "../../shared/types/PromptFeedbackTypes";

const PENDING_KEY = "promptbooster.feedback.pending";
const RESOLVED_KEY = "promptbooster.feedback.resolved";

/** The opt-in posture (`promptBooster.learning.fewShotFromFeedback: true`). */
const ON: FewShotSelectionOptions = { enabled: true, maxExamples: 5, charBudget: 2000 };

function makeHarness() {
  const state = new MockStateRepository();
  const config = new MockConfigurationManager();
  const logger = new MockLogger();
  const feedbackLog = new PromptFeedbackLog(state, config, logger);
  const store = new PromptLearningStore(feedbackLog, logger);
  return { state, config, logger, feedbackLog, store };
}

let recordSeq = 0;

/** A resolved record with fully controlled fields (deterministic timestamps). */
function record(overrides: Partial<PromptFeedbackRecord> = {}): PromptFeedbackRecord {
  return {
    feedbackId: `id-${++recordSeq}`,
    rawPrompt: "profile the slow query",
    enhancedPrompt: "**Task** profile the slow query via `db.query`",
    intent: "edit",
    builtinToolTags: [],
    mcpRefs: ["db.query", "db.explain"],
    outcome: "accept",
    catalogFingerprint: "fp-1",
    timestamp: 1000,
    ...overrides,
  };
}

/** Seed resolved (and optionally pending) records straight into state. */
function seed(
  state: MockStateRepository,
  resolved: PromptFeedbackRecord[],
  pending: PromptFeedbackRecord[] = [],
): void {
  state.workspace.set(RESOLVED_KEY, resolved);
  state.workspace.set(PENDING_KEY, pending);
}

/** Feedback-log stub that fails the test if consulted. */
class UntouchableFeedbackLog {
  public consulted = 0;
  getConfirmedPositives(): ConfirmedPromptPair[] {
    this.consulted++;
    throw new Error("feedback log must not be consulted while few-shot is off");
  }
}

suite("PromptLearningStore", () => {
  // ── Promotion rules ────────────────────────────────────────────────────────

  test("only accept and edit-finalized records are promoted", async () => {
    const { state, store } = makeHarness();
    seed(
      state,
      [
        record({ rawPrompt: "accepted prompt", outcome: "accept", timestamp: 4000 }),
        record({
          rawPrompt: "edited prompt",
          outcome: "edit-finalized",
          finalText: "final text using db.query",
          timestamp: 3000,
        }),
        record({ rawPrompt: "rejected prompt", outcome: "reject", timestamp: 2000 }),
        record({ rawPrompt: "abandoned edit", outcome: "edit-opened", timestamp: 1500 }),
      ],
      [record({ rawPrompt: "never decided", outcome: "pending", timestamp: 1000 })],
    );

    const examples = await store.getFewShotExamples(ON);
    assert.deepStrictEqual(
      examples.map((e) => e.rawPrompt),
      ["accepted prompt", "edited prompt"], // most recent first
      "rejections, edit-opened records, and pendings are never promoted",
    );
  });

  test("edit-finalized promotes the final edited text (real log lifecycle)", async () => {
    const { store, feedbackLog } = makeHarness();
    const id = feedbackLog.createPending({
      rawPrompt: "profile the slow query",
      enhancedPrompt: "ORIGINAL ENHANCEMENT db.query db.explain",
      intent: "edit",
      builtinToolTags: [],
      mcpRefs: ["db.query", "db.explain"],
      catalogFingerprint: "fp-1",
    });
    feedbackLog.resolve(id!, "edit-opened");
    feedbackLog.finalizeEdit(id!, "FINAL EDIT keeping only db.query");

    const examples = await store.getFewShotExamples(ON);
    assert.strictEqual(examples.length, 1);
    assert.strictEqual(examples[0].enhancedPrompt, "FINAL EDIT keeping only db.query");
    assert.deepStrictEqual(examples[0].retainedRefs, ["db.query"]);
  });

  test("no confirmed positives ⇒ zero examples", async () => {
    const { state, store } = makeHarness();
    seed(state, [record({ outcome: "reject" })]);
    assert.deepStrictEqual(await store.getFewShotExamples(ON), []);
  });

  // ── Dedupe ─────────────────────────────────────────────────────────────────

  test("dedupes by normalized raw prompt — most recent wins", async () => {
    const { state, store } = makeHarness();
    seed(state, [
      record({
        rawPrompt: "fix   the\nbug in auth",
        enhancedPrompt: "OLD ENHANCEMENT",
        timestamp: 1000,
      }),
      record({
        rawPrompt: " fix\tthe bug in auth ",
        enhancedPrompt: "NEW ENHANCEMENT",
        timestamp: 2000,
      }),
    ]);

    const examples = await store.getFewShotExamples(ON);
    assert.strictEqual(examples.length, 1, "whitespace variants are one example");
    assert.strictEqual(examples[0].enhancedPrompt, "NEW ENHANCEMENT");
  });

  // ── Caps ───────────────────────────────────────────────────────────────────

  test("caps the example count at maxExamples (most recent kept)", async () => {
    const { state, store } = makeHarness();
    seed(
      state,
      [1, 2, 3, 4, 5, 6, 7].map((n) =>
        record({ rawPrompt: `prompt ${n}`, enhancedPrompt: `E${n}`, timestamp: n }),
      ),
    );

    const examples = await store.getFewShotExamples({
      ...ON,
      maxExamples: 3,
    });
    assert.deepStrictEqual(
      examples.map((e) => e.enhancedPrompt),
      ["E7", "E6", "E5"],
      "the three most recent examples survive the count cap",
    );
  });

  test("char budget truncates at example boundaries, never mid-example", async () => {
    const { state, store } = makeHarness();
    const a: ConfirmedPromptPair = {
      rawPrompt: "prompt A",
      enhancedPrompt: "ENHANCEMENT A",
      retainedRefs: [],
      timestamp: 2000,
    };
    const b: ConfirmedPromptPair = {
      rawPrompt: "prompt B",
      enhancedPrompt: "ENHANCEMENT B",
      retainedRefs: [],
      timestamp: 1000,
    };
    seed(state, [
      record({ rawPrompt: a.rawPrompt, enhancedPrompt: a.enhancedPrompt, timestamp: a.timestamp }),
      record({ rawPrompt: b.rawPrompt, enhancedPrompt: b.enhancedPrompt, timestamp: b.timestamp }),
    ]);

    // Budget for exactly A: A fits, B must not (block would overflow).
    const justA = renderFewShotBlock([a]).length;
    const withBoth = await store.getFewShotExamples({ ...ON, charBudget: justA });
    assert.strictEqual(withBoth.length, 1);
    assert.strictEqual(withBoth[0].enhancedPrompt, "ENHANCEMENT A");
    assert.strictEqual(
      renderFewShotBlock(withBoth).length,
      justA,
      "selected block exactly fills the budget",
    );

    // One char short: not even A fits ⇒ no examples at all (no partial block).
    const none = await store.getFewShotExamples({ ...ON, charBudget: justA - 1 });
    assert.deepStrictEqual(none, [], "an example is never split to fit the budget");
  });

  test("selection never renders a block larger than the budget", async () => {
    const { state, store } = makeHarness();
    seed(
      state,
      [1, 2, 3].map((n) =>
        record({ rawPrompt: `prompt ${n}`, enhancedPrompt: `ENHANCEMENT ${n}`, timestamp: n }),
      ),
    );
    const examples = await store.getFewShotExamples({ ...ON, charBudget: 400 });
    assert.ok(examples.length >= 1, "at least one example fits the budget");
    const block = renderFewShotBlock(examples);
    assert.ok(
      block.length <= 400,
      `block of ${block.length} chars must stay within the 400-char budget`,
    );
  });

  // ── Opt-in gate ────────────────────────────────────────────────────────────

  test("fewShotFromFeedback off ⇒ zero examples without touching the feedback log", async () => {
    const logger = new MockLogger();
    const untouchable = new UntouchableFeedbackLog();
    const store = new PromptLearningStore(untouchable as any, logger);

    // Explicit OFF …
    assert.deepStrictEqual(await store.getFewShotExamples({ ...ON, enabled: false }), []);
    // … and the no-arg default (mirrors the shipped fewShotFromFeedback: false).
    assert.deepStrictEqual(await store.getFewShotExamples(), []);
    assert.strictEqual(untouchable.consulted, 0, "the feedback log was never consulted");
  });

  // ── Golden-set candidates ──────────────────────────────────────────────────

  test("candidate export shape: retained refs only, ≥ 1 retained required", async () => {
    const { state, store } = makeHarness();
    seed(state, [
      // accept ⇒ all injected refs kept (weak).
      record({ rawPrompt: "accepted with refs", outcome: "accept", mcpRefs: ["db.query", "db.explain"] }),
      // edit-finalized keeping only db.query ⇒ strong, retained subset only.
      record({
        rawPrompt: "edited keeping one",
        outcome: "edit-finalized",
        mcpRefs: ["db.query", "db.explain"],
        finalText: "final text using db.query",
      }),
      // edit-finalized keeping none ⇒ NOT a candidate.
      record({
        rawPrompt: "edited keeping none",
        outcome: "edit-finalized",
        mcpRefs: ["db.query"],
        finalText: "final text without any tool",
      }),
      // accept with zero injected refs ⇒ nothing to expect.
      record({ rawPrompt: "accepted no refs", outcome: "accept", mcpRefs: [] }),
    ]);

    const candidates = await store.getGoldenSetCandidates();
    assert.deepStrictEqual(
      candidates,
      [
        { prompt: "accepted with refs", expectedTools: ["db.query", "db.explain"] },
        { prompt: "edited keeping one", expectedTools: ["db.query"] },
      ],
      "expectedTools = retained refs only; ≥ 1 retained required",
    );
  });

  test("no confirmed positives ⇒ no candidates", async () => {
    const { state, store } = makeHarness();
    seed(state, [record({ outcome: "reject" })]);
    assert.deepStrictEqual(await store.getGoldenSetCandidates(), []);
  });

  // ─── Pure helpers ──────────────────────────────────────────────────────────

  test("computeFewShotStamp: stable for the same content, different for new feedback", () => {
    const examples: ConfirmedPromptPair[] = [
      { rawPrompt: "r", enhancedPrompt: "e", retainedRefs: [], timestamp: 1 },
    ];
    const same: ConfirmedPromptPair[] = [
      { rawPrompt: "r", enhancedPrompt: "e", retainedRefs: [], timestamp: 99 }, // timestamp not hashed
    ];
    const grown: ConfirmedPromptPair[] = [
      ...examples,
      { rawPrompt: "r2", enhancedPrompt: "e2", retainedRefs: [], timestamp: 2 },
    ];

    assert.strictEqual(computeFewShotStamp(examples), computeFewShotStamp(same));
    assert.notStrictEqual(computeFewShotStamp(examples), computeFewShotStamp(grown));
    assert.strictEqual(computeFewShotStamp([]), "", "zero examples ⇒ empty stamp");
  });

  test("renderFewShotBlock embeds each example via the prompts template", () => {
    const pair: ConfirmedPromptPair = {
      rawPrompt: "raw text",
      enhancedPrompt: "enhanced text",
      retainedRefs: [],
      timestamp: 1,
    };
    const rendered = renderFewShotExample(pair);
    assert.ok(rendered.includes("raw text"));
    assert.ok(rendered.includes("enhanced text"));

    const block = renderFewShotBlock([pair]);
    assert.ok(block.startsWith("### Accepted Prompt Examples (few-shot)"));
    assert.ok(block.includes(rendered));
    assert.strictEqual(renderFewShotBlock([]), "");
  });
});
