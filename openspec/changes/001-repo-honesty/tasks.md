# Tasks

Size: about 2 evenings. No task changes a file under `src/`. No task changes `version` in `package.json`.

## 1. True files

- [ ] 1.1 Replace `LICENSE` with the full MIT text. Keep the line `Copyright (c) 2026 Son Quach`. [REQ-REL-001] Verify: `grep -q "Permission is hereby granted, free of charge" LICENSE && grep -q "WITHOUT WARRANTY OF ANY KIND" LICENSE && grep -q "Copyright (c) 2026 Son Quach" LICENSE`
- [ ] 1.2 Add the entries `[0.2.4]` and `[0.2.3]` to `CHANGELOG.md` from `git log`. Add an `Unreleased` entry with the freeze, its reason, and the manifest changes of task 2.1. Remove the stale line about planned Marketplace publication under 0.1.0. [REQ-REL-002] Verify: `grep -q "^## \[0.2.3\]" CHANGELOG.md && grep -q "^## \[Unreleased\]" CHANGELOG.md && grep -qi "frozen" CHANGELOG.md && test "$(grep '^## \[[0-9]' CHANGELOG.md | head -1 | sed 's/^## \[\([^]]*\)\].*/\1/')" = "$(node -p "require('./package.json').version")"`
- [ ] 1.3 Rewrite the first 30 lines of the README: the status, the plugin direction with a link to `decisions/ADR-004-plugin-first.md`, the legacy note with the date and the VS Code link. Move the `@PromptBooster` content under a section `Legacy VS Code extension`. [REQ-REL-005] Verify: `head -30 README.md | grep -q "Legacy" && head -30 README.md | grep -q "February 2027" && head -30 README.md | grep -q "https://code.visualstudio.com/api/extension-guides/ai/chat" && ! head -30 README.md | grep -q "@PromptBooster" && grep -q "^## .*Legacy VS Code extension" README.md`
- [ ] 1.4 Remove `Automatic prompt interception` and the line that says `src/core` never imports `vscode` from the README. Add a `Known issues` list to the legacy section with the two issues of REQ-REL-005. [REQ-REL-005] Verify: `! grep -qi "automatic prompt interception" README.md && ! grep -q "never imports" README.md && grep -q "Known issues" README.md && grep -qi "fingerprint" README.md && grep -qi "workspace trust" README.md`
- [ ] 1.5 Correct `AGENTS.md`: the overview states the freeze and the plugin, the Meta-MCP line and the word `intercepts` go, and the `vscode` rule says that seven files break it. Keep the "Specs and workflow" section. [REQ-REL-017] Verify: `! grep -q "driving current work" AGENTS.md && ! grep -qi "intercepts" AGENTS.md && grep -qi "frozen" AGENTS.md && grep -q "Specs and workflow" AGENTS.md`

## 2. Safe manifest and CI

- [ ] 2.1 In `package.json`, add `capabilities.untrustedWorkspaces` with `supported: false` and a `description`. Set `scope: "machine"` on `promptBooster.mcp.probeServers` and rewrite its description as manual-only. Start the manifest `description` with `Legacy (Local harness only):`. [REQ-REL-016] Verify: `node -e "const p=require('./package.json'),s=p.contributes.configuration.properties['promptBooster.mcp.probeServers'];process.exit(p.capabilities.untrustedWorkspaces.supported===false&&s.scope==='machine'&&!/activation|config change/i.test(s.description)&&p.description.startsWith('Legacy (Local harness only)')&&p.version==='0.2.4'?0:1)" && npm run compile`
- [ ] 2.2 Add `.github/workflows/ci.yml` with the blocking steps of REQ-REL-004 and one Electron step with `continue-on-error: true`. [REQ-REL-004] Verify: `test -f .github/workflows/ci.yml && grep -q "pull_request" .github/workflows/ci.yml && grep -q "npm run compile" .github/workflows/ci.yml && grep -q "npm run lint" .github/workflows/ci.yml && grep -q "check --strict" .github/workflows/ci.yml && grep -q "validate --all --strict" .github/workflows/ci.yml && grep -q "continue-on-error: true" .github/workflows/ci.yml`
- [ ] 2.3 Run the gate. [REQ-REL-004] Verify: `npm run compile && npm run lint && npx -y spec-ctx@0.6.0 check --strict && npx -y @fission-ai/openspec@2.1.0 validate --all --strict --no-interactive`

## Workflow follow-up

- Archive with `openspec archive 001-repo-honesty -y`, then run `specctx build`.
