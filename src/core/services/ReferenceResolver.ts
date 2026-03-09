/**
 * ReferenceResolver — Enhancement 3
 *
 * Resolves VS Code chat references into actual content before the LLM call.
 * Handles two sources:
 *   1. request.references (drag-and-drop / autocomplete)
 *   2. Inline tokens typed in the prompt (#file:, #selection, #editor, #terminalLastCommand)
 */
import * as vscode from "vscode";
import { IFileSystem } from "../../shared/interfaces/IFileSystem";
import { ILogger } from "../../shared/interfaces/ILogger";

/** Maximum characters to read from a single file reference. */
const FILE_CONTENT_MAX_CHARS = 8000;

export interface ResolvedReference {
  label: string;    // e.g. "src/auth.ts" or "selection"
  content: string;  // resolved text content
  type: "file" | "selection" | "editor" | "terminal" | "snippet";
}

export class ReferenceResolver {
  constructor(
    private fileSystem: IFileSystem,
    private logger: ILogger,
  ) {}

  /**
   * Resolve explicit references from request.references (drag-and-drop,
   * autocomplete-selected variables, etc.)
   */
  async resolve(refs: readonly vscode.ChatPromptReference[]): Promise<string> {
    const resolved: ResolvedReference[] = [];

    for (const ref of refs) {
      if (ref.value instanceof vscode.Uri) {
        try {
          const raw = await this.fileSystem.readFile(ref.value);
          const content = this.truncate(raw);
          const label = vscode.workspace.asRelativePath(ref.value);
          resolved.push({ label, content, type: "file" });
        } catch {
          this.logger.warn(
            `ReferenceResolver: could not read file reference: ${(ref.value as vscode.Uri).fsPath}`,
          );
        }
      } else if (ref.value instanceof vscode.Location) {
        try {
          const doc = await vscode.workspace.openTextDocument(
            ref.value.uri,
          );
          const text = doc.getText(ref.value.range);
          const label = `${vscode.workspace.asRelativePath(ref.value.uri)}:${
            ref.value.range.start.line + 1
          }`;
          resolved.push({ label, content: text, type: "selection" });
        } catch {
          this.logger.warn("ReferenceResolver: could not read location reference");
        }
      } else if (typeof ref.value === "string") {
        resolved.push({
          label: ref.id ?? "snippet",
          content: ref.value,
          type: "snippet",
        });
      }
    }

    return this.formatResolved(resolved);
  }

  /**
   * Parse inline reference tokens typed directly in the prompt.
   * Returns a cleaned prompt (tokens replaced) and the resolved content list.
   */
  async resolveInlineTokens(prompt: string): Promise<{
    cleanPrompt: string;
    resolved: ResolvedReference[];
  }> {
    const resolved: ResolvedReference[] = [];
    let cleanPrompt = prompt;

    // #file:<path>
    const fileTokenRe = /#file:(\S+)/g;
    for (const match of prompt.matchAll(fileTokenRe)) {
      const relativePath = match[1];
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (wsFolder) {
        const uri = vscode.Uri.joinPath(wsFolder.uri, relativePath);
        try {
          const raw = await this.fileSystem.readFile(uri);
          const content = this.truncate(raw);
          resolved.push({ label: relativePath, content, type: "file" });
          cleanPrompt = cleanPrompt.replace(match[0], `\`${relativePath}\``);
        } catch {
          this.logger.warn(
            `ReferenceResolver: inline #file token: could not read ${relativePath}`,
          );
        }
      }
    }

    // #selection
    if (/#selection\b/i.test(prompt)) {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) {
        const text = editor.document.getText(editor.selection);
        resolved.push({ label: "selection", content: text, type: "selection" });
        cleanPrompt = cleanPrompt.replace(/#selection\b/gi, "the selected code");
      }
    }

    // #editor
    if (/#editor\b/i.test(prompt)) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const raw = editor.document.getText();
        const content = this.truncate(raw);
        const label = vscode.workspace.asRelativePath(editor.document.uri);
        resolved.push({ label, content, type: "editor" });
        cleanPrompt = cleanPrompt.replace(/#editor\b/gi, `file \`${label}\``);
      }
    }

    // #terminalLastCommand — VS Code doesn't expose terminal content via API.
    // Preserve the token so Copilot resolves it server-side.
    if (/#terminalLastCommand\b/i.test(prompt)) {
      resolved.push({
        label: "terminalLastCommand",
        content: "[Resolved by Copilot at runtime]",
        type: "terminal",
      });
    }

    return { cleanPrompt, resolved };
  }

  formatResolved(resolved: ResolvedReference[]): string {
    if (resolved.length === 0) return "";

    return resolved
      .map((r) => {
        const lang =
          r.type === "file" || r.type === "editor"
            ? this.inferLanguage(r.label)
            : "";
        return `### Reference: \`${r.label}\`\n\`\`\`${lang}\n${r.content}\n\`\`\``;
      })
      .join("\n\n");
  }

  private truncate(content: string): string {
    if (content.length <= FILE_CONTENT_MAX_CHARS) return content;
    return (
      content.slice(0, FILE_CONTENT_MAX_CHARS) +
      `\n... [truncated at ${FILE_CONTENT_MAX_CHARS} chars]`
    );
  }

  private inferLanguage(filename: string): string {
    const ext = filename.split(".").pop() ?? "";
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescript",
      js: "javascript", jsx: "javascript",
      py: "python", go: "go", rs: "rust", java: "java",
      md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
      css: "css", html: "html", sh: "bash",
    };
    return map[ext] ?? "";
  }
}
