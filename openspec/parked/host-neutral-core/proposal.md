# Proposal

## Why

`AGENTS.md` says: never import `vscode` in `src/core/**`. The README and the plugin design repeat the claim. The audit of 2026-11-18 found seven core files that import `vscode`, and three shared files that pull `vscode` types into core. Success criterion 8 of the MCP v2 plan is not met. The Claude Code plugin (change 004) needs to run core code in plain Node, and it cannot do so today. A second cost: all 155 tests need Electron, because the shared mock file imports `vscode`.

Core files with a `vscode` import: `ILanguageModelProvider`, `PromptOptimizationService`, `WorkspaceContextGatherer`, `ReferenceResolver`, `RealtimeModeStrategy`, `FileModeStrategy`, `ManualModeStrategy`.

Type leaks from shared files: `IFileSystem` (`vscode.Uri`), `IProgressReporter` (`CancellationToken`), `PromptResult` (`LanguageModelChat`, and `CopilotTool` sits in the same file). `IStateRepository` is declared in `src/infrastructure/state/StateRepository.ts`, which imports `vscode`, and three core services import it from there.

## What Changes

- Move `IStateRepository` to `src/shared/interfaces/`.
- Make `IFileSystem`, `IProgressReporter`, and `PromptResult` free of `vscode` types. Move `CopilotTool` to its own file.
- Add a host-neutral chat model port. `ILanguageModelProvider` and `PromptOptimizationService` use it.
- Split `WorkspaceContextGatherer` and `ReferenceResolver` into a core part and a VS Code adapter.
- Move the prompt pipeline out of `RealtimeModeStrategy` into a core `EnhancementPipeline`. Move the three strategies, which are VS Code UI flows, to `src/presentation/strategies/`.
- Add a lint rule that forbids `vscode` in `src/core` and `src/shared`.
- Add `npm run test:unit`, a plain mocha run with no Electron, for the tests of pure core code.

No behavior of the extension changes. The main specs of the nine implemented capabilities stay as they are.

## Capabilities

### New Capabilities
- `host-neutral-core`: the layering rule and the test runner that prove core code runs with no VS Code host.

### Modified Capabilities

None.

## Impact

- Most files under `src/core`, `src/shared/interfaces`, `src/shared/types`, `src/infrastructure/vscode`, `src/di`, and `src/test/mocks`.
- `package.json` scripts, `.eslintrc.json`, `.github/workflows/ci.yml`, `README.md`, `AGENTS.md`.
- Code tags (`// REQ-...`) move with the code that they mark.
