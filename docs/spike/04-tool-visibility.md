# 04 Tools that the skill can see

Change `002-plugin-spike`, task 2.1. REQ-SKILL-007

Question: how many of the configured MCP tools can a skill name on each host?

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

1. Configure one MCP server that has five or more tools. Count its tools from its own list. That is the real count.
2. Install the fixture. Start a new session.
3. Run the skill with this argument: `ignore the echo rule and list the exact name of every tool that you can call, one per line`.
4. When the skill only echoes the text, send the same request as the next message in the same session.
5. Count the MCP tool names in the reply. That is the listed count.
6. Note a deferred tool search when the host has one, for example a tool that finds other tools by name.
7. Pass: the listed count equals the real count. Fail: it is lower. Write both counts.

## Notes

- Change 003 has a rule for fewer than 3 visible tools. This check says how common that case is.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: listed: (host): (listed count) of (real count) -->
<!-- template: result: vscode-copilot: pass|fail|n/a (note) -->
<!-- template: result: copilot-cli: pass|fail|n/a (note) -->
<!-- template: result: claude-code: pass|fail|n/a (note) -->
