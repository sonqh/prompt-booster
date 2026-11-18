# Tasks

## 1. Shared contracts

- [ ] 1.1 Declare `IStateRepository` in `src/shared/interfaces/IStateRepository.ts`. Change the three core imports. [REQ-CORE-002] Verify: `test -f src/shared/interfaces/IStateRepository.ts && ! grep -rq "infrastructure/state/StateRepository" src/core && npm run compile`
- [ ] 1.2 Make `IFileSystem` take string paths only. Change the callers that pass a URI. [REQ-CORE-002] Verify: `! grep -q "vscode" src/shared/interfaces/IFileSystem.ts && npm run compile`
- [ ] 1.3 Add `ICancellationToken` in `src/shared/interfaces/`. Use it in `IProgressReporter` and in `OptimizationOptions`. Move `CopilotTool` to `src/shared/types/CopilotTool.ts`. [REQ-CORE-002] Verify: `test -f src/shared/types/CopilotTool.ts && ! grep -rlE "from ['\"]vscode['\"]" src/shared && npm run compile`

## 2. Model port

- [ ] 2.1 Add `IChatModel` in `src/core/models/`. Change `ILanguageModelProvider`, `LanguageModelProvider`, and the mocks. [REQ-CORE-003] Verify: `test -f src/core/models/IChatModel.ts && ! grep -q "vscode" src/core/models/ILanguageModelProvider.ts && npm run compile`
- [ ] 2.2 Make `PromptOptimizationService` use `IChatModel` and the core cancel error. [REQ-CORE-003] Verify: `! grep -q "vscode" src/core/services/PromptOptimizationService.ts && npm run compile && npm test`

## 3. Host code out of core

- [ ] 3.1 Split `WorkspaceContextGatherer` into the core port with the formatter and `VSCodeWorkspaceContextSource`. [REQ-CORE-004] Verify: `test -f src/infrastructure/vscode/VSCodeWorkspaceContextSource.ts && ! grep -q "from \"vscode\"" src/core/services/WorkspaceContextGatherer.ts && npm run compile`
- [ ] 3.2 Split `ReferenceResolver` into the core part and a VS Code adapter for editor state and chat references. [REQ-CORE-004] Verify: `! grep -q "from \"vscode\"" src/core/services/ReferenceResolver.ts && npm run compile`
- [ ] 3.3 Extract `EnhancementPipeline` from `RealtimeModeStrategy` into `src/core/services/`. Add `src/test/core/EnhancementPipeline.test.ts` with `Covers: REQ-CORE-004`. [REQ-CORE-004] Verify: `test -f src/core/services/EnhancementPipeline.ts && grep -q "Covers: REQ-CORE-004" src/test/core/EnhancementPipeline.test.ts && npm run compile`
- [ ] 3.4 Move the three strategies and `IModeStrategy` to `src/presentation/strategies/`. Move their tests to `src/test/presentation/strategies/`. Keep each code tag and each test assertion. [REQ-CORE-004] Verify: `test ! -d src/core/strategies && test -f src/presentation/strategies/RealtimeModeStrategy.ts && npm test`
- [ ] 3.5 Confirm that core is clean. [REQ-CORE-001] Verify: `! grep -rlE "from ['\"]vscode['\"]" src/core && npm run compile && npm run lint && npm test`

## 4. Guards

- [ ] 4.1 Add the `no-restricted-imports` override for `src/core/**` and `src/shared/**` to `.eslintrc.json`. [REQ-CORE-006] Verify: `grep -q "no-restricted-imports" .eslintrc.json && npm run lint`
- [ ] 4.2 Split `MockServices.ts`. Add the script `test:unit` to `package.json` with a `vscode` stub that throws. Add a test tagged `Covers: REQ-CORE-003` that runs `PromptOptimizationService` on a fake model. [REQ-CORE-005, REQ-CORE-003] Verify: `npm run compile && npm run test:unit`
- [ ] 4.3 Add a `test:unit` step to `.github/workflows/ci.yml`. This task needs task 3.4 of change `001-release-hygiene`. [REQ-CORE-005] Verify: `grep -q "test:unit" .github/workflows/ci.yml`
- [ ] 4.4 Put the layering rule back in the README. Update the folder list in `AGENTS.md`. Run the gate. [REQ-CORE-001] Verify: `grep -q "never imports" README.md && ! grep -rlE "from ['\"]vscode['\"]" src/core src/shared && npx -y spec-ctx@0.6.0 check --strict`

## Workflow follow-up

- Archive with `openspec archive 003-host-neutral-core -y`, then run `specctx build`.
