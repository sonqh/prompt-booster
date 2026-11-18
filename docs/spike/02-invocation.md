# 02 Invoke the skill with an argument

Change `002-plugin-spike`, task 1.3. REQ-SKILL-006

Question: what is the exact invocation name on each host, and does `$ARGUMENTS` arrive?

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

1. Install the fixture with the form that passed check 01.
2. Type `/` and find the skill. Write down the name as the host shows it. The expected name is `/spike-fixture:echo`.
3. Run the skill with the argument `hello 42`.
4. Pass: the reply holds `SPIKE-ECHO args=[hello 42]`.
5. Fail: the reply holds `SPIKE-ECHO args=[$ARGUMENTS]`, or empty brackets, or no marker. Write which one in the note.

## Notes

- The skill text uses `$ARGUMENTS`. A host that does not replace it prints the literal text. That result is a fail for the argument and still names the invocation.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: invocation: (host): (exact name, for example /spike-fixture:echo) -->
<!-- template: result: vscode-copilot: pass|fail|n/a (note) -->
<!-- template: result: copilot-cli: pass|fail|n/a (note) -->
<!-- template: result: claude-code: pass|fail|n/a (note) -->
