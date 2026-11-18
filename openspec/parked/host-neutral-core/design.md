# Design

## Context

- TypeScript erases a type-only import. `ToolAffinityClassifier`, `McpServerProbe`, `MCPToolRegistry`, and the three Phase E services compile to JavaScript with no `require("vscode")`. Their tests need Electron only because `src/test/mocks/MockServices.ts` imports `vscode`.
- `PromptOptimizationService` calls `vscode.LanguageModelChatMessage.User` and checks `vscode.CancellationError` at run time.
- `RealtimeModeStrategy` mixes two jobs: it builds the optimizer input and runs the cache and feedback steps, and it writes markdown and buttons to a `vscode.ChatResponseStream`.
- `ManualModeStrategy` and `FileModeStrategy` are UI flows: a workspace edit, an input box, the clipboard, notifications. The plugin design marks all three strategies as "rewrite, do not port".
- The plugin design allowed "no change to core except two interface lifts". The audit shows that this is not enough. The owner has an open question on how far the refactor can go. This design takes the smallest refactor that makes the rule true.

## Goals / Non-Goals

**Goals:**
- `grep` finds no `vscode` import under `src/core` and `src/shared`.
- The extension behaves as before, and `npm test` passes with the same test count or more.
- Pure core tests run in plain Node in a few seconds.

**Non-Goals:**
- New behavior.
- A Node implementation of any port. Change 004 adds those.
- A split of the repository into packages.

## Decisions

- Declare `IStateRepository` in `src/shared/interfaces/IStateRepository.ts`. `StateRepository.ts` imports it and exports it again for one release, so no import outside core breaks. Refs: REQ-CORE-002
- `IFileSystem` takes `string` paths only. `VSCodeFileSystem` keeps its own overloads for `vscode.Uri`. Callers that hold a URI pass `uri.fsPath`. Refs: REQ-CORE-002
- Add `ICancellationToken` (`isCancellationRequested`, `onCancellationRequested`) in `src/shared/interfaces/`. `vscode.CancellationToken` fits this shape, so adapters pass it with no wrapper. `IProgressReporter` and `OptimizationOptions` use it. Refs: REQ-CORE-002
- Add `IChatModel` in `src/core/models/`: `id`, `name`, and `sendText(system: string, user: string, token?: ICancellationToken): AsyncIterable<string>`. `LanguageModelProvider` wraps a `vscode.LanguageModelChat` in it and maps `vscode.CancellationError` to a core `OperationCancelledError`. The alternative is to copy the VS Code message types into core, which ties core to one host. Refs: REQ-CORE-003
- Split the gatherer. Core keeps the `WorkspaceContext` type, an `IWorkspaceContextSource` port with `gather()`, and the pure `formatAsPromptPreamble`. The VS Code code moves to `src/infrastructure/vscode/VSCodeWorkspaceContextSource.ts`. Refs: REQ-CORE-004, REQ-ENH-002
- Split the resolver. Core keeps token parsing, truncation, and `formatResolved`, and reads editor state through an `IEditorContext` port. Chat references reach core as plain data `{ kind: "file" | "range" | "text", ... }`. The adapter maps `vscode.ChatPromptReference` to that shape. Refs: REQ-CORE-004, REQ-ENH-003, REQ-ENH-004
- Extract `EnhancementPipeline` into `src/core/services/`. It holds `buildPromptWithContext`, the cache and few-shot steps, and feedback capture, and it returns a plain result. `RealtimeModeStrategy` keeps the gates and the rendering and moves to `src/presentation/strategies/` with the other two strategies. `IModeStrategy` moves with them. The alternative is a stream port in core. It would keep UI wording in core for no reuse. Refs: REQ-CORE-004, REQ-ENH-007
- Add an ESLint `no-restricted-imports` override for `src/core/**` and `src/shared/**` that names `vscode`. A new leak then fails `npm run lint`. Refs: REQ-CORE-006
- Split `MockServices.ts` into `MockCoreServices.ts` (no `vscode`) and `MockVSCodeServices.ts`. Add `npm run test:unit`: `mocha --ui tdd` on the compiled tests under `out/test/core` that do not need `vscode`. A stub module makes `require("vscode")` throw in that run, so a leak fails at once. `npm test` stays the full Electron run. Refs: REQ-CORE-005

## Risks / Trade-offs

- The refactor touches most core files, and code tags can be lost. Mitigation: `specctx check --strict` after each task group reports a requirement that lost its tag or its test.
- A behavior change can slip in. Mitigation: no test assertion changes in this change. A test that must change is a finding to report.
- The owner can decide that the plugin must not refactor core. Mitigation: this change stands on its own. `AGENTS.md` and criterion 8 of the v2 plan already require it.
- `test:unit` and `npm test` can drift. Mitigation: CI runs both.
