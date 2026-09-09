/**
 * ExportMcpGoldenCandidatesCommand (Phase E3) —
 * `promptBooster.exportMcpGoldenCandidates`.
 *
 * Writes `{ prompt, expectedTools }[]` entries from confirmed positives that
 * kept ≥ 1 MCP ref (PromptLearningStore.getGoldenSetCandidates) to a
 * user-chosen file via the Save dialog. Maintainers curate and merge the
 * result into `src/test/fixtures/mcp-golden-prompts.json` — a human gate;
 * nothing is auto-promoted into the golden set. The file is written only
 * where the user points it (feedback text never lands in the repo by itself).
 */
import * as vscode from "vscode";
import { IPromptLearningStore } from "../../core/services/PromptLearningStore";
import { ILogger } from "../../shared/interfaces/ILogger";

export class ExportMcpGoldenCandidatesCommand {
  constructor(
    private learningStore: IPromptLearningStore,
    private logger: ILogger,
  ) {}

  async execute(): Promise<void> {
    try {
      const candidates = await this.learningStore.getGoldenSetCandidates();
      if (candidates.length === 0) {
        this.logger.log(
          "ExportMcpGoldenCandidates: no confirmed-positive candidates yet",
        );
        vscode.window.showInformationMessage(
          "PromptBooster: no golden-set candidates yet — accept prompts that inject MCP tools, or finalize an edited one keeping its tool references.",
        );
        return;
      }

      const folder = vscode.workspace.workspaceFolders?.[0];
      const defaultUri = folder
        ? vscode.Uri.joinPath(folder.uri, "mcp-golden-candidates.json")
        : vscode.Uri.file("mcp-golden-candidates.json");
      const target = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { JSON: ["json"] },
        saveLabel: "Export Golden-Set Candidates",
      });
      if (!target) return; // user cancelled — nothing written

      const content = `${JSON.stringify(candidates, null, 2)}\n`;
      await vscode.workspace.fs.writeFile(
        target,
        Buffer.from(content, "utf8"),
      );
      this.logger.log(
        `ExportMcpGoldenCandidates: wrote ${candidates.length} candidate(s) to ${target.fsPath}`,
      );
      vscode.window.showInformationMessage(
        `PromptBooster: exported ${candidates.length} golden-set candidate(s). ` +
          "Review and merge them into src/test/fixtures/mcp-golden-prompts.json (maintainer curation).",
      );
    } catch (error) {
      this.logger.error("ExportMcpGoldenCandidatesCommand failed", error as Error);
      vscode.window.showErrorMessage(
        `Failed to export golden-set candidates: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  register(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "promptBooster.exportMcpGoldenCandidates",
      () => this.execute(),
    );
    context.subscriptions.push(disposable);
  }
}
