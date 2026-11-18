# 03 The skill stays unloaded without the slash command

Change `002-plugin-spike`, task 1.4. REQ-SKILL-006

Question: does `disable-model-invocation: true` keep the skill out of a session until the user types the command?

Status: not run. This file holds no result.

## Header

Fill these lines when you run the check. Keep each line at the start of a line, outside a comment.

date:
version: vscode-copilot:
version: copilot-cli:
version: claude-code:

How to read each version:

- `vscode-copilot` (VS Code with the Copilot harness): `code --version`, and the version of the Copilot Chat extension
- `copilot-cli` (Copilot CLI): `copilot --version`
- `claude-code` (Claude Code): `claude --version`

## Steps

### Each host

1. Install the fixture. Start a new session.
2. Ask a fitting question with no slash command: `Echo the text hello 42 back to me with a marker.`
3. Pass: the reply does not hold `SPIKE-ECHO`, and the host shows no load of the skill `echo`.
4. Fail: the reply holds `SPIKE-ECHO`, or the host shows that it loaded the skill.
5. Write in the note how you saw that the skill stayed unloaded, for example the tool log or the debug view.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: result: vscode-copilot: pass|fail|n/a (note) -->
<!-- template: result: copilot-cli: pass|fail|n/a (note) -->
<!-- template: result: claude-code: pass|fail|n/a (note) -->
