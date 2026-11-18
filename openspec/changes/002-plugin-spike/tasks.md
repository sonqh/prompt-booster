# Tasks

Size: about 2 evenings. Every task from 1.2 on needs the owner machine and accounts (VS Code with Copilot, the Copilot CLI, Claude Code). An agent prepares the files and stops. A `fail` or `n/a` result closes a task. Only a missing result leaves it open.

## 1. Fixture and install

- [ ] 1.1 Create `docs/spike/fixture-plugin/` with a root `plugin.json`, `.claude-plugin/plugin.json`, and `skills/echo/SKILL.md` that prints the marker `SPIKE-ECHO` and its argument, with `disable-model-invocation: true`. Create the eight result files with the `date:`, `version:`, and steps sections and no result. [REQ-SKILL-004] Verify: `test -f docs/spike/fixture-plugin/plugin.json && test -f docs/spike/fixture-plugin/.claude-plugin/plugin.json && grep -q "SPIKE-ECHO" docs/spike/fixture-plugin/skills/echo/SKILL.md && test "$(ls docs/spike/0[1-8]-*.md | wc -l)" -eq 8`
- [ ] 1.2 (owner) Install the fixture from a local folder, from a Git URL, and from a subfolder path on each host. Record the form that works and the validator command of each host. [REQ-SKILL-006] Verify: `for h in vscode-copilot copilot-cli claude-code; do grep -Eq "^result: $h: (pass|fail|n/a)" docs/spike/01-install.md || exit 1; done; grep -q "^validator: " docs/spike/01-install.md && grep -q "^date: " docs/spike/01-install.md`
- [ ] 1.3 (owner) Run the fixture skill with an argument on each host. Record the exact invocation name and if `$ARGUMENTS` arrives. [REQ-SKILL-006] Verify: `for h in vscode-copilot copilot-cli claude-code; do grep -Eq "^result: $h: (pass|fail|n/a)" docs/spike/02-invocation.md || exit 1; done; grep -q "^invocation: " docs/spike/02-invocation.md`
- [ ] 1.4 (owner) Ask a fitting question with no slash command on each host. Record if the skill stayed unloaded. [REQ-SKILL-006] Verify: `for h in vscode-copilot copilot-cli claude-code; do grep -Eq "^result: $h: (pass|fail|n/a)" docs/spike/03-explicit-only.md || exit 1; done`

## 2. Tools and harness

- [ ] 2.1 (owner) With one MCP server of five or more tools configured, let the skill list every tool that it can call. Record the listed count and the real count per host. [REQ-SKILL-007] Verify: `for h in vscode-copilot copilot-cli claude-code; do grep -Eq "^result: $h: (pass|fail|n/a)" docs/spike/04-tool-visibility.md || exit 1; done; grep -q "^listed: " docs/spike/04-tool-visibility.md`
- [ ] 2.2 (owner) Record the VS Code version that made the Copilot harness the default, with a first-party source, and the Session Target of a clean profile. [REQ-SKILL-008] Verify: `grep -Eq "^result: vscode-copilot: (pass|fail|n/a)" docs/spike/05-default-harness.md && grep -q "^source: http" docs/spike/05-default-harness.md`
- [ ] 2.3 (owner) Run one prompt headless on the Copilot CLI and on Claude Code with the fixture plugin. Record if the output names the first tool call. [REQ-SKILL-007] Verify: `for h in copilot-cli claude-code; do grep -Eq "^result: $h: (pass|fail|n/a)" docs/spike/06-headless.md || exit 1; done`
- [ ] 2.4 (owner) Try the install and the skill in the Copilot app. `n/a` is a valid result. [REQ-SKILL-006] Verify: `grep -Eq "^result: copilot-app: (pass|fail|n/a)" docs/spike/07-copilot-app.md`
- [ ] 2.5 (owner) Run `Boost This Prompt` and `Process Prompt File` of the frozen extension on the Copilot harness. [REQ-SKILL-008] Verify: `grep -Eq "^result: vscode-copilot: (pass|fail|n/a)" docs/spike/08-legacy-extension.md && grep -q "Process Prompt File" docs/spike/08-legacy-extension.md`

## 3. Summary

- [ ] 3.1 Write `docs/spike/README.md` with the `hosts:` line, one `invocation:` line per host, the install form, and each result that changes the plan of change 003 or 004. [REQ-SKILL-004] Verify: `grep -Eq "^hosts: [a-z, -]+$" docs/spike/README.md && grep -q "^invocation: " docs/spike/README.md && npx -y spec-ctx@0.6.0 check --strict`

## Workflow follow-up

- Archive with `openspec archive 002-plugin-spike -y`, then run `specctx build`.
