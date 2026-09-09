/**
 * Tests for PromptFeedbackLog (Phase E1)
 *
 * Pending → terminal state machine, per-ref label derivation, ring buffer,
 * lazy pending TTL, workspace-state persistence via IStateRepository, and the
 * pure prompt-file helpers (feedback-id extraction, comment stripping) used by
 * UsePromptVersionCommand.
 */
import * as assert from "assert";
import {
  PromptFeedbackLog,
  extractFeedbackId,
  stripHtmlComments,
  deriveRefLabels,
  PendingFeedbackInput,
} from "../../core/services/PromptFeedbackLog";
import { MockStateRepository } from "../mocks/MockStateRepository";
import { MockConfigurationManager } from "../mocks/MockServices";
import { MockLogger } from "../mocks/MockLogger";
import { PromptFeedbackRecord } from "../../shared/types/PromptFeedbackTypes";

const pendingInput = (
  overrides: Partial<PendingFeedbackInput> = {},
): PendingFeedbackInput => ({
  rawPrompt: "profile the slow query",
  enhancedPrompt: "**Task** Profile the slow query via `db.query`",
  intent: "edit",
  builtinToolTags: ["#editor"],
  mcpRefs: ["db.query", "db.explain"],
  catalogFingerprint: "fp-1",
  ...overrides,
});

function makeHarness(overrides: Partial<{ config: MockConfigurationManager }> = {}) {
  const state = new MockStateRepository();
  const config = overrides.config ?? new MockConfigurationManager();
  const logger = new MockLogger();
  const log = new PromptFeedbackLog(state, config, logger);
  return { state, config, logger, log };
}

/** Serialize until fire-and-forget persistence promises settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

suite("PromptFeedbackLog", () => {
  // ── Lifecycle transitions ──────────────────────────────────────────────────

  test("createPending returns an id and persists a pending record", async () => {
    const { log, state } = makeHarness();
    const id = log.createPending(pendingInput());
    assert.ok(id, "feedbackId returned");
    await settle();
    const stored = state.getWorkspace<PromptFeedbackRecord[]>(
      "promptbooster.feedback.pending",
    );
    assert.ok(stored?.some((r) => r.feedbackId === id && r.outcome === "pending"));
  });

  test("createPending returns undefined when feedback capture is disabled", () => {
    const config = new MockConfigurationManager();
    config.setFeedbackLearningOptions({ feedbackEnabled: false });
    const { log, state } = makeHarness({ config });
    const id = log.createPending(pendingInput());
    assert.strictEqual(id, undefined);
    assert.strictEqual(
      state.getWorkspace("promptbooster.feedback.pending"),
      undefined,
      "nothing may be written when disabled",
    );
  });

  test("pending → accept / reject / edit-opened transitions land in resolved", async () => {
    const { log } = makeHarness();
    const acceptId = log.createPending(pendingInput({ rawPrompt: "a" }));
    const rejectId = log.createPending(pendingInput({ rawPrompt: "b" }));
    const editId = log.createPending(pendingInput({ rawPrompt: "c" }));

    log.resolve(acceptId!, "accept");
    log.resolve(rejectId!, "reject");
    log.resolve(editId!, "edit-opened");

    const report = log.getReport();
    assert.strictEqual(report.funnel.accept, 1);
    assert.strictEqual(report.funnel.reject, 1);
    assert.strictEqual(report.funnel["edit-opened"], 1);
    assert.strictEqual(report.funnel["edit-finalized"], 0);
  });

  test("edit-opened upgrades to edit-finalized with the final text", () => {
    const { log } = makeHarness();
    const id = log.createPending(pendingInput());
    log.resolve(id!, "edit-opened");
    log.finalizeEdit(id!, "final edited text keeping db.query");
    const report = log.getReport();
    assert.strictEqual(report.funnel["edit-finalized"], 1);
    assert.strictEqual(report.funnel["edit-opened"], 0);
  });

  test("terminal outcomes are immutable (accept never re-resolves)", () => {
    const { log } = makeHarness();
    const id = log.createPending(pendingInput());
    log.resolve(id!, "accept");
    log.resolve(id!, "reject"); // must be a no-op — id no longer pending
    log.finalizeEdit(id!, "text"); // must be a no-op — outcome is accept
    const report = log.getReport();
    assert.strictEqual(report.funnel.accept, 1);
    assert.strictEqual(report.funnel.reject, 0);
    assert.strictEqual(report.funnel["edit-finalized"], 0);
  });

  test("resolve and finalizeEdit with unknown ids are no-ops", () => {
    const { log } = makeHarness();
    log.resolve("nope", "accept");
    log.finalizeEdit("nope", "text");
    const report = log.getReport();
    assert.strictEqual(report.funnel.accept, 0);
    assert.strictEqual(report.funnel["edit-finalized"], 0);
  });

  test("finalizeEdit on a pending (not edit-opened) record is a no-op", () => {
    const { log } = makeHarness();
    const id = log.createPending(pendingInput());
    log.finalizeEdit(id!, "text");
    const report = log.getReport();
    assert.strictEqual(report.funnel["edit-finalized"], 0);
    assert.strictEqual(report.pending, 1);
  });

  // ── Ring buffer + pending TTL ──────────────────────────────────────────────

  test("resolved records are capped at historyLimit (ring buffer)", async () => {
    const config = new MockConfigurationManager();
    config.setFeedbackLearningOptions({ historyLimit: 3 });
    const { log, state } = makeHarness({ config });
    for (let i = 0; i < 5; i++) {
      const id = log.createPending(pendingInput({ rawPrompt: `p${i}` }));
      log.resolve(id!, "accept");
    }
    await settle();
    const stored = state.getWorkspace<PromptFeedbackRecord[]>(
      "promptbooster.feedback.resolved",
    );
    assert.strictEqual(stored?.length, 3, "ring cap enforced");
    assert.ok(
      stored!.every((r) => ["p2", "p3", "p4"].includes(r.rawPrompt)),
      "oldest records dropped",
    );
  });

  test("pending records expire lazily (TTL) and cannot be resolved afterwards", async () => {
    const { log, state } = makeHarness();
    const id = log.createPending(pendingInput());
    await settle(); // let fire-and-forget persistence land
    // Simulate a record that has been pending far beyond the TTL.
    const stored = state.getWorkspace<PromptFeedbackRecord[]>(
      "promptbooster.feedback.pending",
    )!;
    stored[0].timestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days
    state.workspace.set("promptbooster.feedback.pending", stored);

    // A fresh instance lazily drops expired pendings on load.
    const config = new MockConfigurationManager();
    const logger = new MockLogger();
    const log2 = new PromptFeedbackLog(state, config, logger);
    log2.resolve(id!, "accept");
    const report = log2.getReport();
    assert.strictEqual(report.funnel.accept, 0, "expired pending is not resolved");
    assert.strictEqual(report.pending, 0, "expired pending dropped from the funnel");
  });

  test("state survives a reload: resolved records reload from workspace state", async () => {
    const { log, state } = makeHarness();
    const id = log.createPending(pendingInput());
    log.resolve(id!, "edit-opened");
    await settle(); // let fire-and-forget persistence land

    const log2 = new PromptFeedbackLog(
      state,
      new MockConfigurationManager(),
      new MockLogger(),
    );
    log2.finalizeEdit(id!, "reloaded final text");
    const report = log2.getReport();
    assert.strictEqual(report.funnel["edit-finalized"], 1);
  });

  // ── Report aggregation ─────────────────────────────────────────────────────

  test("missing state ⇒ empty aggregates (no division errors)", () => {
    const { log } = makeHarness();
    const report = log.getReport();
    assert.strictEqual(report.pending, 0);
    assert.deepStrictEqual(report.funnel, {
      accept: 0,
      reject: 0,
      "edit-opened": 0,
      "edit-finalized": 0,
    });
    assert.strictEqual(report.acceptanceRate, null);
    assert.strictEqual(report.retentionRate, null);
  });

  test("acceptance rate = accept / (accept + reject)", () => {
    const { log } = makeHarness();
    for (let i = 0; i < 3; i++) {
      log.resolve(log.createPending(pendingInput({ rawPrompt: `a${i}` }))!, "accept");
    }
    log.resolve(log.createPending(pendingInput({ rawPrompt: "r" }))!, "reject");
    assert.strictEqual(log.getReport().acceptanceRate, 0.75);
  });

  test("retention rate counts retained-strong vs removed over edit-finalized only", () => {
    const { log } = makeHarness();
    // edit-finalized: db.query retained, db.explain removed
    const id1 = log.createPending(
      pendingInput({ mcpRefs: ["db.query", "db.explain"] }),
    );
    log.resolve(id1!, "edit-opened");
    log.finalizeEdit(id1!, "keep the `db.query` call");

    // accept: contributes funnel count, not retention
    log.resolve(log.createPending(pendingInput())!, "accept");

    const report = log.getReport();
    assert.strictEqual(report.retainedRefs, 1);
    assert.strictEqual(report.removedRefs, 1);
    assert.strictEqual(report.retentionRate, 0.5);
  });

  test("observed tool calls precision is reported when observations exist", () => {
    const { log } = makeHarness();
    const id = log.createPending(
      pendingInput({ observedToolCalls: ["mcp_db_query", "mcp_other_thing"] }),
    );
    log.resolve(id!, "accept");
    const report = log.getReport();
    assert.notStrictEqual(report.observedToolCallPrecision, null);
  });

  // ── Confirmed positives (Phase E3 input) ───────────────────────────────────

  test("confirmed positives: verbatim accepts and refs-retained-after-edit only", () => {
    const { log } = makeHarness();
    const acceptId = log.createPending(
      pendingInput({ rawPrompt: "accept-me", mcpRefs: ["db.query", "db.explain"] }),
    );
    log.resolve(acceptId!, "accept");

    const editId = log.createPending(
      pendingInput({ rawPrompt: "edit-me", mcpRefs: ["db.query", "db.explain"] }),
    );
    log.resolve(editId!, "edit-opened");
    log.finalizeEdit(editId!, "keep only db.query please");

    const rejectId = log.createPending(pendingInput({ rawPrompt: "reject-me" }));
    log.resolve(rejectId!, "reject");

    // Unresolved pending must never be promoted.
    log.createPending(pendingInput({ rawPrompt: "still-pending" }));

    const positives = log.getConfirmedPositives();
    assert.strictEqual(positives.length, 2);
    const acceptPair = positives.find((p) => p.rawPrompt === "accept-me")!;
    assert.deepStrictEqual(acceptPair.retainedRefs, [
      "db.query",
      "db.explain",
    ]); // verbatim accept ⇒ all refs (weak)
    const editPair = positives.find((p) => p.rawPrompt === "edit-me")!;
    assert.deepStrictEqual(editPair.retainedRefs, ["db.query"]); // retained subset (strong)
    assert.strictEqual(editPair.enhancedPrompt, "keep only db.query please");
  });

  // ── Failure posture ────────────────────────────────────────────────────────

  test("IStateRepository throw ⇒ logged, not propagated", async () => {
    const { log, logger, state } = makeHarness();
    state.failOnWrite = true;
    const id = log.createPending(pendingInput()); // must not throw
    assert.ok(id);
    await settle();
    assert.ok(
      logger.warnings.some((w) => w.includes("PromptFeedbackLog")),
      "persistence failure is logged",
    );
  });

  test("state read throw ⇒ empty aggregates, not propagated", () => {
    const state = new MockStateRepository();
    state.getWorkspace = (() => {
      throw new Error("state exploded");
    }) as unknown as typeof state.getWorkspace;
    const log = new PromptFeedbackLog(
      state,
      new MockConfigurationManager(),
      new MockLogger(),
    );
    const report = log.getReport(); // must not throw
    assert.strictEqual(report.pending, 0);
  });

  // ── Pure prompt-file helpers (used by UsePromptVersionCommand) ─────────────

  suite("extractFeedbackId / stripHtmlComments", () => {
    const file = (id?: string) => `<!--
Original Prompt:
profile the slow query

Generated: 2026-09-06T00:00:00.000Z
Mode: File Generation${id ? `\nPromptBooster-Feedback-Id: ${id}` : ""}
-->

**Task**
Profile the slow query.

<!--
Instructions:
1. Edit this prompt as needed
-->
`;

    test("extracts the feedback id from the leading comment block", () => {
      assert.strictEqual(
        extractFeedbackId(file("abc-123")),
        "abc-123",
      );
    });

    test("returns undefined without a feedback header", () => {
      assert.strictEqual(extractFeedbackId(file()), undefined);
    });

    test("ignores ids outside the leading comment block", () => {
      const content =
        "<!--\nplain header\n-->\n\nPromptBooster-Feedback-Id: not-a-real-tag";
      assert.strictEqual(extractFeedbackId(content), undefined);
    });

    test("requires the exact header line format", () => {
      const content = "<!--\nPromptBooster-Feedback-Id:  id-with-trailing  \n-->\nbody";
      assert.strictEqual(extractFeedbackId(content), "id-with-trailing");
    });

    test("stripHtmlComments removes all comments and trims (processPromptFile rule)", () => {
      const stripped = stripHtmlComments(file("abc"));
      assert.ok(!stripped.includes("<!--"));
      assert.ok(stripped.startsWith("**Task**"));
      assert.ok(!stripped.includes("Instructions:"));
    });
  });
});

// Direct unit tests of the per-ref label derivation (pure function).
suite("deriveRefLabels", () => {
  const base = {
    feedbackId: "id",
    rawPrompt: "raw",
    enhancedPrompt: "enhanced",
    intent: "edit" as const,
    builtinToolTags: [],
    mcpRefs: ["db.query", "fs.read_file"],
    catalogFingerprint: "fp",
    timestamp: 0,
  };

  test("edit-finalized: qualifiedName present ⇒ retained-strong", () => {
    const labels = deriveRefLabels({
      ...base,
      outcome: "edit-finalized",
      finalText: "run `db.query` please",
    });
    assert.deepStrictEqual(labels[0], { ref: "db.query", label: "retained-strong" });
    assert.deepStrictEqual(labels[1], {
      ref: "fs.read_file",
      label: "removed",
    });
  });

  test("edit-finalized: both parts present ⇒ retained even without the dotted form", () => {
    const labels = deriveRefLabels({
      ...base,
      outcome: "edit-finalized",
      finalText: "use the db tool's query capability and fs read_file",
    });
    assert.deepStrictEqual(labels[0], { ref: "db.query", label: "retained-strong" });
    assert.deepStrictEqual(labels[1], {
      ref: "fs.read_file",
      label: "retained-strong",
    });
  });

  test("accept ⇒ all retained-weak; reject ⇒ all removed", () => {
    assert.deepStrictEqual(
      deriveRefLabels({ ...base, outcome: "accept" }).map((l) => l.label),
      ["retained-weak", "retained-weak"],
    );
    assert.deepStrictEqual(
      deriveRefLabels({ ...base, outcome: "reject" }).map((l) => l.label),
      ["removed", "removed"],
    );
  });

  test("pending / edit-opened ⇒ no per-ref labels", () => {
    assert.deepStrictEqual(deriveRefLabels({ ...base, outcome: "pending" }), []);
    assert.deepStrictEqual(
      deriveRefLabels({ ...base, outcome: "edit-opened" }),
      [],
    );
  });
});
