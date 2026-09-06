/**
 * WorkspaceContextGatherer — Enhancement 2
 *
 * Gathers rich VS Code workspace context before the LLM call so the optimizer
 * receives grounded information and produces significantly better output.
 * All gathering is best-effort; any failure is silently swallowed.
 */
import * as vscode from "vscode";
import { ILogger } from "../../shared/interfaces/ILogger";

export interface DiagnosticContext {
  file: string;
  line: number;
  severity: "error" | "warning";
  message: string;
}

export interface WorkspaceContext {
  activeFile?: {
    path: string;
    language: string;
    cursorLine: number;
    surroundingCode: string; // ±10 lines around cursor
    selection?: string;      // only if non-empty
  };
  openFiles: string[];       // paths of other open editors (capped at 10)
  diagnostics: DiagnosticContext[];
  gitBranch?: string;
  techStack?: string[];       // parsed from package.json
}

export class WorkspaceContextGatherer {
  constructor(private logger: ILogger) {}

  async gather(): Promise<WorkspaceContext> {
    const ctx: WorkspaceContext = { openFiles: [], diagnostics: [] };

    // ── Active editor ───────────────────────────────────────────────────────
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      const cursor = editor.selection.active;
      const startLine = Math.max(0, cursor.line - 10);
      const endLine = Math.min(doc.lineCount - 1, cursor.line + 10);
      const surroundingRange = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

      ctx.activeFile = {
        path: vscode.workspace.asRelativePath(doc.uri),
        language: doc.languageId,
        cursorLine: cursor.line + 1,
        surroundingCode: doc.getText(surroundingRange),
      };

      if (!editor.selection.isEmpty) {
        ctx.activeFile.selection = doc.getText(editor.selection);
      }
    }

    // ── Other open files ────────────────────────────────────────────────────
    ctx.openFiles = vscode.workspace.textDocuments
      .filter((d) => d.uri.scheme === "file" && d !== editor?.document)
      .map((d) => vscode.workspace.asRelativePath(d.uri))
      .slice(0, 10);

    // ── Diagnostics (errors + warnings, capped at 5) ────────────────────────
    const allDiagnostics = vscode.languages.getDiagnostics();
    ctx.diagnostics = allDiagnostics
      .flatMap(([uri, diags]) =>
        diags
          .filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning)
          .map(
            (d): DiagnosticContext => ({
              file: vscode.workspace.asRelativePath(uri),
              line: d.range.start.line + 1,
              severity:
                d.severity === vscode.DiagnosticSeverity.Error
                  ? "error"
                  : "warning",
              message: d.message,
            }),
          ),
      )
      .slice(0, 5);

    // ── Git branch ──────────────────────────────────────────────────────────
    try {
      const gitExt = vscode.extensions.getExtension("vscode.git");
      if (gitExt?.isActive) {
        const api = gitExt.exports.getAPI(1);
        const repo = api.repositories[0];
        if (repo) {
          ctx.gitBranch = repo.state.HEAD?.name;
        }
      }
    } catch {
      /* git not available – skip */
    }

    // ── Tech stack from package.json ────────────────────────────────────────
    try {
      const pkgFiles = await vscode.workspace.findFiles(
        "package.json",
        "**/node_modules/**",
        1,
      );
      if (pkgFiles.length > 0) {
        const raw = await vscode.workspace.fs.readFile(pkgFiles[0]);
        const pkg = JSON.parse(Buffer.from(raw).toString("utf-8"));
        const deps = Object.keys({
          ...pkg.dependencies,
          ...pkg.devDependencies,
        });
        ctx.techStack = deps.slice(0, 15);
      }
    } catch {
      /* package.json not found or malformed – skip */
    }

    this.logger.log(
      `WorkspaceContextGatherer: activeFile=${ctx.activeFile?.path ?? "none"}, ` +
        `openFiles=${ctx.openFiles.length}, diagnostics=${ctx.diagnostics.length}, ` +
        `gitBranch=${ctx.gitBranch ?? "none"}, ` +
        `techStack=${ctx.techStack?.length ?? 0} deps`,
    );

    return ctx;
  }

  /**
   * Serialize gathered context into a compact, LLM-readable preamble string.
   */
  formatAsPromptPreamble(ctx: WorkspaceContext): string {
    const lines: string[] = ["### Workspace Context (auto-gathered)"];

    if (ctx.activeFile) {
      lines.push(
        `**Active File:** \`${ctx.activeFile.path}\` (${ctx.activeFile.language})`,
      );
      lines.push(`**Cursor:** line ${ctx.activeFile.cursorLine}`);
      if (ctx.activeFile.selection) {
        lines.push(
          `**Selected Text:**\n\`\`\`\n${ctx.activeFile.selection}\n\`\`\``,
        );
      }
      lines.push(
        `**Code Around Cursor:**\n\`\`\`${ctx.activeFile.language}\n${ctx.activeFile.surroundingCode}\n\`\`\``,
      );
    }

    if (ctx.openFiles.length > 0) {
      lines.push(`**Other Open Files:** ${ctx.openFiles.join(", ")}`);
    }

    if (ctx.diagnostics.length > 0) {
      lines.push("**Diagnostics:**");
      ctx.diagnostics.forEach((d) =>
        lines.push(
          `  - [${d.severity.toUpperCase()}] ${d.file}:${d.line} — ${d.message}`,
        ),
      );
    }

    if (ctx.gitBranch) {
      lines.push(`**Git Branch:** \`${ctx.gitBranch}\``);
    }

    if (ctx.techStack && ctx.techStack.length > 0) {
      lines.push(`**Tech Stack:** ${ctx.techStack.join(", ")}`);
    }

    return lines.join("\n");
  }
}
