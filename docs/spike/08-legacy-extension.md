# 08 The frozen extension on the Copilot harness

Change `002-plugin-spike`, task 2.5. REQ-SKILL-008

Question: do the two file commands of the frozen extension still run when Session Target is Copilot?

Status: not run. This file holds no result.

## Header

Fill these lines when you run the check. Keep each line at the start of a line, outside a comment.

date:
version: vscode-copilot:

How to read each version:

- `vscode-copilot` (VS Code with the Copilot harness): `code --version`, and the version of the Copilot Chat extension

## Steps

### vscode-copilot

1. Build the extension from this repository and install the VSIX, or press F5 in the repository. Write the extension version `0.2.4` in the note.
2. Trust the workspace. The extension does not activate in an untrusted workspace.
3. Set Session Target to Copilot.
4. Create `test.prompt.md` with one line of text. Right-click it and run `PromptBooster: Boost This Prompt`. Record if the file content changed.
5. Set `promptBooster.operationMode` to `file`. Run `PromptBooster: Process Prompt File` on the same file. Record what the chat view received.
6. Pass: both commands do their work. Fail: one of them fails. Name the command that failed in the note.

## Notes

- The result feeds the legacy section of the root README.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: command: Boost This Prompt: (what happened) -->
<!-- template: command: Process Prompt File: (what happened) -->
<!-- template: result: vscode-copilot: pass|fail|n/a (note) -->
