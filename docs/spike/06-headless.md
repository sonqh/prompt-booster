# 06 A headless run that names the first tool call

Change `002-plugin-spike`, task 2.3. REQ-SKILL-007

Question: does a headless run with the fixture plugin print the first tool call?

Status: not run. This file holds no result.

## Header

Fill these lines when you run the check. Keep each line at the start of a line, outside a comment.

date:
version: copilot-cli:
version: claude-code:

How to read each version:

- `copilot-cli` (Copilot CLI): `copilot --version`
- `claude-code` (Claude Code): `claude --version`

## Steps

### copilot-cli

1. Go to a folder with a file `README.md`.
2. Run `copilot -p "Read README.md and print its first line."` with the fixture plugin installed. Read `copilot --help` for the flag that prints tool calls or JSON output. Record the full command.
3. Pass: the output names the first tool call. Fail: it does not.

### claude-code

1. Go to the same folder.
2. Run `claude -p --output-format stream-json --plugin-dir <absolute path of the fixture folder> "Read README.md and print its first line."` When the CLI asks for `--verbose` with `stream-json`, add it and record that.
3. Pass: the output holds a tool call entry that names the first tool. Fail: it does not.

## Notes

- A fail keeps the A/B run of change 004 manual. It changes nothing else.
- Also record if the plugin skill is usable in a headless run. This is a note, not a result line.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: command: (host): (the full command that you ran) -->
<!-- template: result: copilot-cli: pass|fail|n/a (note) -->
<!-- template: result: claude-code: pass|fail|n/a (note) -->
