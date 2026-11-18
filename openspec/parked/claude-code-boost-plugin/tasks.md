# Tasks

This change needs change `003-host-neutral-core`. Do not start group 2 before 003 is in the archive.

## 1. Facts and skeleton (M1)

- [ ] 1.1 Check each fact of section 2 of `docs/plans/claude-code-plugin-design.md` on the current Claude Code CLI: the hook events and their fields, the `$ARGUMENTS` substitution, a multi-line heredoc in a skill, the four MCP config scopes, and a plugin data folder. Write `packages/claude-code-plugin/FACTS.md`. Stop and ask when a difference breaks a requirement. [REQ-PLUG-001] Verify: `test -s packages/claude-code-plugin/FACTS.md && grep -q "CLI version" packages/claude-code-plugin/FACTS.md && grep -q "UserPromptSubmit" packages/claude-code-plugin/FACTS.md && grep -q "PostToolUse" packages/claude-code-plugin/FACTS.md`
- [ ] 1.2 Confirm that change 003 is done: core and shared have no `vscode` import. [REQ-PLUG-002] Verify: `! grep -rlE "from ['\"]vscode['\"]" src/core src/shared && ls openspec/changes/archive | grep -q "003-host-neutral-core"`
- [ ] 1.3 Create the package: `package.json`, the esbuild script, `.claude-plugin/plugin.json`, `hooks/hooks.json`, and the folder `skills/boost/`. [REQ-PLUG-002] Verify: `test -f packages/claude-code-plugin/.claude-plugin/plugin.json && test -f packages/claude-code-plugin/hooks/hooks.json && claude plugin validate packages/claude-code-plugin`

## 2. Boost path (M1)

- [ ] 2.1 Write the Node adapters for the core ports: file system, state repository on JSON files with mode `0600`, logger, and config from `settings.json`. [REQ-PLUG-008] Verify: `npm --prefix packages/claude-code-plugin run build && node --test packages/claude-code-plugin/test/state.test.js`
- [ ] 2.2 Write the inventory provider for the four MCP scopes, the skills and subagents listing, and the fingerprint. [REQ-PLUG-004] Verify: `npm --prefix packages/claude-code-plugin run build && node --test packages/claude-code-plugin/test/inventory.test.js`
- [ ] 2.3 Write the `claude -p` chat model and the `claude-boost` CLI: stdin, inventory, `classifyTools`, optimizer, literal `mcp__` names, and the fallback to the original prompt. [REQ-PLUG-005] Verify: `npm --prefix packages/claude-code-plugin run build && node --test packages/claude-code-plugin/test/boost-cli.test.js`
- [ ] 2.4 Write `skills/boost/SKILL.md` with the heredoc form that task 1.1 confirmed. [REQ-PLUG-003] Verify: `grep -q "claude-boost" packages/claude-code-plugin/skills/boost/SKILL.md && node --test packages/claude-code-plugin/test/skill-quoting.test.js`

## 3. Telemetry (M1)

- [ ] 3.1 Write the tool-use hook. [REQ-PLUG-006] Verify: `npm --prefix packages/claude-code-plugin run build && node --test packages/claude-code-plugin/test/tool-use-hook.test.js`
- [ ] 3.2 Write the pending record in the CLI and the prompt-submit hook that links a session. [REQ-PLUG-007] Verify: `npm --prefix packages/claude-code-plugin run build && node --test packages/claude-code-plugin/test/correlation.test.js`
- [ ] 3.3 Check the M1 exit criteria and record the run in `packages/claude-code-plugin/docs/verification-m1.md`: a rewrite that names a real tool, the no-server output, and telemetry with the right session. [REQ-PLUG-005, REQ-PLUG-006, REQ-PLUG-007] Verify: `test -s packages/claude-code-plugin/docs/verification-m1.md && node --test packages/claude-code-plugin/test/`

## 4. Cache and report (M2)

- [ ] 4.1 Add the M2 section to `FACTS.md`. Wire the file-backed response cache with the plugin key. [REQ-PLUG-009, REQ-PLUG-001] Verify: `grep -q "M2" packages/claude-code-plugin/FACTS.md && node --test packages/claude-code-plugin/test/cache.test.js`
- [ ] 4.2 Add skills and subagents to scoring. Add the API key chat model. [REQ-PLUG-010] Verify: `node --test packages/claude-code-plugin/test/wider-inventory.test.js packages/claude-code-plugin/test/api-model.test.js`
- [ ] 4.3 Write the report module and `skills/boost-report/SKILL.md`. [REQ-PLUG-011] Verify: `test -f packages/claude-code-plugin/skills/boost-report/SKILL.md && node --test packages/claude-code-plugin/test/report.test.js`

## 5. Learning and packaging (M3)

- [ ] 5.1 Add the M3 section to `FACTS.md`. Derive `used-strong` labels at report time. Add opt-in few-shot and opt-in ambient hints with their budgets. [REQ-PLUG-012, REQ-PLUG-001] Verify: `grep -q "M3" packages/claude-code-plugin/FACTS.md && node --test packages/claude-code-plugin/test/learning.test.js packages/claude-code-plugin/test/ambient.test.js`
- [ ] 5.2 Add a runtime tool provider that reads the `system/init` message of stream-json output, and the opt-in probe through `McpServerProbe`. [REQ-PLUG-004] Verify: `node --test packages/claude-code-plugin/test/runtime-inventory.test.js`
- [ ] 5.3 Write the plugin README with the list of files read and written and the install steps. Commit the hook bundles. Run the gate. [REQ-PLUG-013] Verify: `grep -q "Files read" packages/claude-code-plugin/README.md && grep -q "Files written" packages/claude-code-plugin/README.md && claude plugin validate packages/claude-code-plugin && node --test packages/claude-code-plugin/test/ && npx -y spec-ctx@0.6.0 check --strict`

## Workflow follow-up

- Archive with `openspec archive 004-claude-code-boost-plugin -y`, then run `specctx build`.
