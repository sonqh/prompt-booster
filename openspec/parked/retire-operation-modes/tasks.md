# Tasks

Size: about 2 evenings. This change needs the approval of the owner (see the proposal) and change `001-release-hygiene`.

## 1. Remove the mode surface

- [ ] 1.1 In `package.json`, remove the four settings, the four commands, and the mode condition in the `when` clause of the Process title button. [REQ-CFG-007, REQ-CFG-008, REQ-FILE-007] Verify: `! grep -qE "operationMode|simplifiedContextMode|autoOptimize|showPreview|switchMode|toggleAutoOptimization|testFileGeneration|testRealtimeMode" package.json && node scripts/check-release.mjs --rule commands`
- [ ] 1.2 Delete `OperationMode.ts`, `SwitchModeCommand.ts` with its DI symbol and factory, `canHandle`, `FileModeStrategy.execute`, the `ProcessButton` status bar class, and the mode, auto-optimize, simplified-mode, and preview methods of the config service and the mock. Make the participant handler and `RealtimeModeStrategy` run with no mode check. Make the status bar item fixed. Remove the three `canHandle` tests and the auto-optimize test with their tags. Add a test tagged `Covers: REQ-CHAT-008` and `SCN-CHAT-008-1`. Move the code tags of REQ-CHAT-002 to REQ-CHAT-008 and of REQ-FILE-004 to REQ-FILE-007. [REQ-CHAT-008, REQ-CFG-004, REQ-BOOST-002, REQ-FILE-006] Verify: `! grep -rnE "operationMode|OperationMode|canHandle|SwitchMode|[sS]howPreview|[aA]utoOptimiz|[sS]implifiedContextMode" src && grep -q "SCN-CHAT-008-1" src/test/core/strategies/RealtimeModeStrategy.test.ts && npm run lint && npm run test:headless`
- [ ] 1.3 Make `PromptFileCodeLensProvider` return the Process lens for every `.prompt.md` file. Add `src/test/presentation/ui/PromptFileCodeLens.test.ts` with `Covers: REQ-FILE-007` and both scenario IDs. [REQ-FILE-007] Verify: `grep -q "SCN-FILE-007-2" src/test/presentation/ui/PromptFileCodeLens.test.ts && npm run test:headless`

## 2. Keep it true

- [ ] 2.1 Change the release check step in `.github/workflows/ci.yml` to `--all`. [REQ-CFG-007, REQ-CFG-008] Verify: `grep -q "check-release.mjs --all" .github/workflows/ci.yml && npm run compile && node scripts/check-release.mjs --all`
- [ ] 2.2 Update the settings table and the command list of the README, the mode text in `AGENTS.md`, and add a `Removed` list to the `Unreleased` entry of the CHANGELOG with the replacement for each item. [REQ-CFG-008] Verify: `! grep -nE "operationMode|simplifiedContextMode|autoOptimize|showPreview|Switch Operation Mode|Toggle Auto-Optimization|Test File Generation|Test Realtime Mode" README.md && ! grep -niE "operation modes?" AGENTS.md && grep -q "^### Removed" CHANGELOG.md`
- [ ] 2.3 Remove the closed debt from the baseline and run the gate. [REQ-CFG-007] Verify: `npx -y spec-ctx@0.6.0 baseline prune && npm run compile && npm run lint && npx -y spec-ctx@0.6.0 check --strict && npx -y @fission-ai/openspec@2.1.0 validate --all --strict --no-interactive`

## Workflow follow-up

- Archive with `openspec archive 003-retire-operation-modes -y`.
- Then retire the four removed IDs with `specctx id retire <ID> "removed by change 003"`: REQ-CFG-001, REQ-CFG-003, and the two requirements that the `## REMOVED` blocks of the chat and file deltas name. Then run `specctx build`.
