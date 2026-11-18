# Tasks

## 1. Dead commands and settings

- [ ] 1.1 Remove `promptBooster.testFileGeneration` and `promptBooster.testRealtimeMode` from `package.json` and from the README command list. [REQ-CFG-007] Verify: `! grep -q "testFileGeneration\|testRealtimeMode" package.json && ! grep -qi "Test File Generation\|Test Realtime Mode" README.md`
- [ ] 1.2 Remove `promptBooster.showPreview` from `package.json` and `isShowPreviewEnabled` from `IConfigurationManager`, `ConfigurationManager`, and `MockServices`. [REQ-CFG-008] Verify: `! grep -rq "showPreview\|isShowPreviewEnabled" package.json src && npm run compile`
- [ ] 1.3 Change the `modelPreference` fallback in `ConfigurationManager` to `claude-haiku-4.5`. [REQ-CFG-009] Verify: `grep -q '"modelPreference", "claude-haiku-4.5"' src/infrastructure/config/ConfigurationManager.ts && node -e "process.exit(require('./package.json').contributes.configuration.properties['promptBooster.modelPreference'].default==='claude-haiku-4.5'?0:1)"`

## 2. Behavior

- [ ] 2.1 Add `resetPermission()` to `IConfigurationManager`, `ConfigurationManager`, and the mock. Make `configurePermissions` in `CommandRegistry` show a quick pick with `Reset permission decision` and `Open settings`. [REQ-CFG-010] Verify: `grep -q "resetPermission" src/shared/interfaces/IConfigurationManager.ts && grep -q "resetPermission" src/presentation/commands/CommandRegistry.ts && npm run compile && npm run lint`
- [ ] 2.2 In the catch block of `RealtimeModeStrategy.execute`, quote the original prompt and show a `Use Original` button. Add a test for a rejecting optimizer in `RealtimeModeStrategy.test.ts` with the tags `Covers: REQ-CHAT-006` and `SCN-CHAT-006-1`. [REQ-CHAT-006] Verify: `grep -q "SCN-CHAT-006-1" src/test/core/strategies/RealtimeModeStrategy.test.ts && npm test`

## 3. Release files

- [ ] 3.1 Replace `LICENSE` with the full MIT text. Keep the line `Copyright (c) 2026 Son Quach`. [REQ-REL-001] Verify: `grep -q "Permission is hereby granted, free of charge" LICENSE && grep -q "WITHOUT WARRANTY OF ANY KIND" LICENSE && grep -q "Copyright (c) 2026 Son Quach" LICENSE`
- [ ] 3.2 Add the entries `[0.2.4]` and `[0.2.3]` to `CHANGELOG.md` from `git log`. Remove the stale line about planned Marketplace publication under 0.1.0. [REQ-REL-002] Verify: `grep -q "^## \[0.2.3\]" CHANGELOG.md && test "$(grep -m1 '^## \[' CHANGELOG.md | sed 's/^## \[\([^]]*\)\].*/\1/')" = "$(node -p "require('./package.json').version")"`
- [ ] 3.3 Add `@vscode/vsce` to `devDependencies`. Add the excluded names of REQ-REL-003 to `.vscodeignore`. [REQ-REL-003] Verify: `npm run compile && npx --no-install vsce ls > out/vsix-files.txt && ! grep -Eq "^(AGENTS\.md|CLAUDE\.md|implementation_plan\.md|walkthrough\.md|spec-ctx\.toml|\.claude/|\.opencode/|\.agents/|\.ctx/|openspec/|decisions/|docs/|\.github/)" out/vsix-files.txt`
- [ ] 3.4 Add `.github/workflows/ci.yml` with the steps of REQ-REL-004 and a cache for `.vscode-test`. [REQ-REL-004] Verify: `test -f .github/workflows/ci.yml && grep -q "npm ci" .github/workflows/ci.yml && grep -q "npm run compile" .github/workflows/ci.yml && grep -q "npm run lint" .github/workflows/ci.yml && grep -q "xvfb-run" .github/workflows/ci.yml && grep -q "pull_request" .github/workflows/ci.yml`
- [ ] 3.5 Correct the README: say that enhancement runs on `@PromptBooster`, remove `Automatic prompt interception`, and remove the line that says `src/core` never imports `vscode`. [REQ-REL-005] Verify: `! grep -q "Automatic prompt interception" README.md && ! grep -q "never imports" README.md && grep -q "@PromptBooster" README.md`
- [ ] 3.6 Run the full gate. [REQ-REL-004] Verify: `npm run compile && npm run lint && npx -y spec-ctx@0.6.0 check --strict && npx -y @fission-ai/openspec@2.1.0 validate --all --strict --no-interactive`

## Workflow follow-up

- Archive with `openspec archive 001-release-hygiene -y`, then run `specctx build`.
