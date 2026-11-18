# Tasks

Size: about 4 evenings. On Linux with no display, the Electron suite needs `xvfb-run`. Task 1.1 adds `npm run test:headless`, which handles that. Later `Verify:` lines use it.

## 1. CI first

- [ ] 1.1 Add `@vscode/vsce` to `devDependencies`. Add `scripts/test-headless.mjs` and the script `test:headless` to `package.json`. Add `.github/workflows/ci.yml` with the steps of REQ-REL-004 and a cache for `.vscode-test`. [REQ-REL-004] Verify: `test -f .github/workflows/ci.yml && grep -q "pull_request" .github/workflows/ci.yml && grep -q "npm run lint" .github/workflows/ci.yml && grep -q "test:headless" .github/workflows/ci.yml && grep -q "npm run package" .github/workflows/ci.yml && test -f scripts/test-headless.mjs && npx --no-install vsce --version`
- [ ] 1.2 Write `scripts/check-release.mjs` with the six rules and the flags `--list`, `--rule`, and `--all`. The `blocking` list holds `changelog`, `readme`, `vsix`, and `model-default`. Call the script from `ci.yml`. [REQ-REL-007] Verify: `node scripts/check-release.mjs --list | grep -q "vsix" && node scripts/check-release.mjs --list | grep -q "settings" && grep -q "check-release" .github/workflows/ci.yml && ! node scripts/check-release.mjs --rule commands`

## 2. Release files

- [ ] 2.1 Change the `modelPreference` fallback in `ConfigurationManager` and in the mock to `claude-haiku-4.5`. [REQ-CFG-009] Verify: `node scripts/check-release.mjs --rule model-default && npm run compile`
- [ ] 2.2 Replace `LICENSE` with the full MIT text. Keep the line `Copyright (c) 2026 Son Quach`. [REQ-REL-001] Verify: `grep -q "Permission is hereby granted, free of charge" LICENSE && grep -q "WITHOUT WARRANTY OF ANY KIND" LICENSE && grep -q "Copyright (c) 2026 Son Quach" LICENSE`
- [ ] 2.3 Add the entries `[0.2.4]` and `[0.2.3]` to `CHANGELOG.md` from `git log`, and an `Unreleased` entry. Remove the stale line about planned Marketplace publication under 0.1.0. [REQ-REL-002] Verify: `grep -q "^## \[0.2.3\]" CHANGELOG.md && node scripts/check-release.mjs --rule changelog`
- [ ] 2.4 Extend `.vscodeignore` so that the VSIX holds only the files of REQ-REL-003. [REQ-REL-003] Verify: `npm run compile && node scripts/check-release.mjs --rule vsix`
- [ ] 2.5 Remove `@vscode/chat-extension-utils` and `@vscode/prompt-tsx` from `dependencies`. Run `npm audit fix` with no `--force`. [REQ-REL-006] Verify: `! grep -qE "chat-extension-utils|prompt-tsx" package.json && npm ci && npm audit --omit=dev --audit-level=high && npm run compile && npm run lint`

## 3. True text

- [ ] 3.1 Correct the README: say that enhancement runs on `@PromptBooster`, remove `Automatic prompt interception`, and remove the line that says `src/core` never imports `vscode`. Change the chat participant description in `package.json`. [REQ-REL-005] Verify: `node scripts/check-release.mjs --rule readme && ! grep -q "Intercepts and optimizes" package.json && grep -q "@PromptBooster" README.md`
- [ ] 3.2 Rewrite the permission dialog text in `ConfigurationManager.requestPermission` with real line breaks and no promise of interception or preview. [REQ-REL-005] Verify: `! grep -qE "Intercept chat prompts|Show preview before submitting" src/infrastructure/config/ConfigurationManager.ts && ! grep -qF '\\n' src/infrastructure/config/ConfigurationManager.ts && grep -q "@PromptBooster" src/infrastructure/config/ConfigurationManager.ts && npm run compile`

## 4. Behavior

- [ ] 4.1 Add `setPermission()` and `resetPermission()` to `IConfigurationManager`, `ConfigurationManager`, and the mock. Make `configurePermissions` in `CommandRegistry` show `Allow`, `Revoke`, and `Reset (ask again)`. Add `src/test/infrastructure/ConfigurationManager.test.ts` with `Covers: REQ-CFG-010` and both scenario IDs. [REQ-CFG-010] Verify: `grep -q "SCN-CFG-010-1" src/test/infrastructure/ConfigurationManager.test.ts && grep -q "resetPermission" src/presentation/commands/CommandRegistry.ts && npm run test:headless`
- [ ] 4.2 In the catch block of `RealtimeModeStrategy.execute`, quote the original prompt and show a `Use Original` button. Add two tests to `RealtimeModeStrategy.test.ts`, a rejecting optimizer and a slow one, with `Covers: REQ-CHAT-006` and the scenario IDs. Make the timeout a constructor option so the slow test takes milliseconds. [REQ-CHAT-006] Verify: `grep -q "SCN-CHAT-006-1" src/test/core/strategies/RealtimeModeStrategy.test.ts && grep -q "SCN-CHAT-006-2" src/test/core/strategies/RealtimeModeStrategy.test.ts && npm run test:headless`
- [ ] 4.3 Remove the closed debt from the baseline and run the full gate. [REQ-REL-004] Verify: `npx -y spec-ctx@0.6.0 baseline prune && npm run compile && npm run lint && node scripts/check-release.mjs && npx -y spec-ctx@0.6.0 check --strict && npx -y @fission-ai/openspec@2.1.0 validate --all --strict --no-interactive`

## Workflow follow-up

- Archive with `openspec archive 001-release-hygiene -y`, then run `specctx build`.
