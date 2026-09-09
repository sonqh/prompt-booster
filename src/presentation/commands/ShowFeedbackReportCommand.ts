/**
 * ShowFeedbackReportCommand (Phase E3) — `promptBooster.showFeedbackReport`.
 *
 * Renders the acceptance-based feedback report to the PromptBooster output
 * channel (replaces the never-implemented `promptBooster.showMcpReport`):
 *   - outcome funnel counts (pending → accept / reject / edit-opened →
 *     edit-finalized),
 *   - acceptance rate = accept / (accept + reject),
 *   - per-ref retention rate = retained / (retained + removed) over
 *     edit-finalized records,
 *   - optimizer response-cache hit rate,
 *   - observed toolCalls precision, labeled best-effort when observations
 *     exist (feature-detected side channel — no reliable ground truth),
 *   - golden-set candidate count (feeds the export command).
 *
 * Only this presentation layer touches vscode; the aggregation itself lives in
 * the core services (PromptFeedbackLog.getReport, PromptResponseCache.
 * getCacheStats) injected through their interfaces.
 */
import * as vscode from "vscode";
import { IPromptFeedbackLog } from "../../core/services/PromptFeedbackLog";
import { IPromptResponseCache } from "../../core/services/PromptResponseCache";
import { IPromptLearningStore } from "../../core/services/PromptLearningStore";
import { ILogger } from "../../shared/interfaces/ILogger";

export class ShowFeedbackReportCommand {
  constructor(
    private feedbackLog: IPromptFeedbackLog,
    private responseCache: IPromptResponseCache,
    private learningStore: IPromptLearningStore,
    private logger: ILogger,
  ) {}

  async execute(): Promise<void> {
    try {
      const report = this.feedbackLog.getReport();
      const cache = this.responseCache.getCacheStats();
      const candidates = await this.learningStore.getGoldenSetCandidates();

      const pct = (rate: number | null): string =>
        rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;

      this.logger.log("──────────── PromptBooster Feedback Report ────────────");
      this.logger.log("Outcome funnel");
      this.logger.log(
        `  pending (rendered, no decision yet): ${report.pending}`,
      );
      this.logger.log(`  accept:              ${report.funnel.accept}`);
      this.logger.log(`  reject:              ${report.funnel.reject}`);
      this.logger.log(
        `  edit-opened (not finalized): ${report.funnel["edit-opened"]}`,
      );
      this.logger.log(
        `  edit-finalized:      ${report.funnel["edit-finalized"]}`,
      );
      this.logger.log(
        `Acceptance rate (accept / (accept + reject)): ${pct(report.acceptanceRate)}`,
      );
      this.logger.log(
        `Tool-ref retention (retained / (retained + removed), edit-finalized only): ` +
          `${pct(report.retentionRate)} ` +
          `(${report.retainedRefs} retained / ${report.removedRefs} removed)`,
      );
      this.logger.log(
        report.observedToolCallRecords > 0
          ? `Observed toolCalls precision (best-effort, ${report.observedToolCallRecords} observed record(s)): ` +
              `${pct(report.observedToolCallPrecision)}`
          : "Observed toolCalls precision: no observations yet",
      );
      this.logger.log("Optimizer response cache");
      this.logger.log(
        `  hits: ${cache.hits}, misses: ${cache.misses}, hit rate: ${pct(cache.hitRate)}`,
      );
      this.logger.log(
        `Golden-set candidates ready for export: ${candidates.length} ` +
          `(command: PromptBooster: Export MCP Golden-Set Candidates)`,
      );
      this.logger.log("───────────────────────────────────────────────────────");

      this.logger.show(); // reveal the PromptBooster output channel
    } catch (error) {
      this.logger.error("ShowFeedbackReportCommand failed", error as Error);
      vscode.window.showErrorMessage(
        `Failed to show feedback report: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  register(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "promptBooster.showFeedbackReport",
      () => this.execute(),
    );
    context.subscriptions.push(disposable);
  }
}
