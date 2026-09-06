# PromptBooster — Agent Guidelines

VS Code extension that intercepts/enhances prompts before they reach GitHub Copilot. TypeScript, no framework.

## Project Overview

PromptBooster optimizes raw prompts before they reach Copilot, across three operation modes (manual file boosting, realtime chat interception, file generation). See [README.md](README.md) for user-facing features and [docs/promptbooster-enhancement-spec.md](docs/promptbooster-enhancement-spec.md) / [docs/meta-mcp-orchestrator-spec.md](docs/meta-mcp-orchestrator-spec.md) for feature specs driving current work.

## Folder Structure

```
src/
  extension.ts              # activation entry point — wires DI container, commands, UI
  core/
    services/                # business logic (PromptOptimizationService, MCPToolRegistry, WorkspaceContextGatherer, ReferenceResolver, ToolAffinityClassifier)
    strategies/               # one IModeStrategy per operation mode (Manual/Realtime/File)
    models/                   # ILanguageModelProvider interface
    prompts/                  # system prompt templates (SystemPrompts.ts)
  infrastructure/
    vscode/                   # vscode API adapters (LanguageModelProvider, VSCodeFileSystem, VSCodeOutputLogger, VSCodeProgressService)
    config/                   # ConfigurationManager (reads workspace settings)
    state/                    # StateRepository (extension global/workspace state)
  presentation/
    commands/                 # command handlers + CommandRegistry
    participants/              # ChatParticipantHandler (@PromptBooster)
    ui/                        # StatusBarController, CodeLens (ProcessButton)
  di/
    Container.ts               # symbol-keyed service locator
    ServiceRegistry.ts          # wires every service — register new services here
    types.ts                    # symbol constants — add new ones here
  shared/
    interfaces/                 # ILogger, IFileSystem, IConfigurationManager, IProgressReporter
    types/                       # OperationMode, PromptResult
  test/
    core/                        # unit tests mirroring src/core/
    mocks/                       # MockLogger, MockFileSystem, MockServices
    suite/                        # mocha entrypoint (index.ts)
docs/                          # architecture diagrams + in-flight feature specs
```

## Architecture

Clean layered architecture with manual dependency injection (no reflection/decorators):

- `src/core/` — domain logic: `services/` (business logic, e.g. `PromptOptimizationService`, `MCPToolRegistry`, `WorkspaceContextGatherer`, `ReferenceResolver`), `strategies/` (one `IModeStrategy` per operation mode: Manual/Realtime/File), `models/` (LM provider interface), `prompts/` (system prompt templates).
- `src/infrastructure/` — VS Code API adapters implementing `shared/interfaces/*` (e.g. `VSCodeFileSystem` implements `IFileSystem`). Keeps `vscode` API usage out of core logic.
- `src/presentation/` — commands, chat participant, status bar/UI.
- `src/di/` — `Container.ts` (simple symbol-keyed service locator), `ServiceRegistry.ts` (wires every service — **register new services here**), `types.ts` (symbol constants — add new ones here).
- `src/shared/` — interfaces and types shared across layers.

**Operation modes** (`OperationMode`): `manual` (boost `.prompt.md` files on right-click), `realtime` (chat participant `@PromptBooster` interception), `file` (generate `.prompt.md` from chat input). Each mode has its own `IModeStrategy` implementation under `core/strategies/`.

Core services always depend on interfaces (`ILogger`, `IFileSystem`, etc.), never concrete `infrastructure/` classes directly — this is what makes them unit-testable without the `vscode` module.

See [docs/architecture_diagrams.md](docs/architecture_diagrams.md) for diagrams and [implementation_plan.md](implementation_plan.md) / [docs/](docs/) for in-flight feature specs.

## Build and Test

```bash
npm run compile   # tsc -p ./  — must pass with zero errors before considering work done
npm run watch     # tsc -watch, for active development
npm run lint      # eslint src --ext ts
npm test          # compiles then runs mocha suite via VS Code test runner (out/test/runTest.js)
npm run package   # builds .vsix into dist/
```

Tests live under `src/test/` mirroring `src/core/` structure, using `MockLogger` / `MockFileSystem` (`src/test/mocks/`) instead of real VS Code APIs — services must stay constructible with only mocked interfaces. Run a single test file via mocha's grep if iterating (see `src/test/suite/index.ts`).

## Conventions

- New service → add symbol to `di/types.ts`, register factory in `di/ServiceRegistry.ts`, inject dependencies through the constructor (never `container.resolve()` inside a service).
- Define an interface in `shared/interfaces/` (or alongside the service, e.g. `IPromptOptimizationService.ts`) before implementing — services are consumed by their interface type everywhere outside the registry.
- Never import `vscode` directly in `src/core/**`; go through an `infrastructure/` adapter.
- `tsconfig.json` has `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` — fix these rather than suppressing.
- `MCPToolRegistry` discovers MCP servers from `.vscode/mcp.json` (with `.cline/mcp.json` fallback) — see its tests for the expected JSON shape before changing parsing logic.

## Best Practices

- **Test before you trust.** Every new service/strategy needs a unit test under `src/test/` using `MockLogger`/`MockFileSystem`/`MockServices` — no real `vscode` API in unit tests. `npm run compile && npm run lint && npm test` must pass before a change is considered done.
- **Small, additive changes.** Don't refactor unrelated modules while implementing a feature; open a separate task for cleanup.
- **No secrets in code or logs.** Language model calls, config, and logger output must never include API keys or user file contents beyond what's needed for the active request.
- **Fail gracefully.** External inputs (MCP config files, workspace settings, LM responses) are untrusted — parse defensively and fall back to an empty/default state rather than throwing across a command boundary (see `MCPToolRegistry`'s config fallback as the model to follow).
- **Keep the system prompts data, not logic.** Prompt text belongs in `core/prompts/`; don't inline large prompt strings in services or strategies.

## Delegated Development Workflow

This project is built by delegating work to AI agents while a human (you) stays the final approver. Work flows through four roles, each with a narrower job than "do everything":

```
PO  →  Architect  →  Developer  →  QA  →  (back to Developer if issues, or done)
```

| Role | Responsibility | Must NOT do |
|---|---|---|
| **PO** (Product Owner) | Debates new feature ideas with you, challenges scope/priority, writes a short spec + acceptance criteria to `docs/specs/` | Write implementation code or touch `src/**` |
| **Architect** | Turns an approved spec into a concrete plan: which files/services/DI registrations are needed, how it fits the layered architecture | Implement business logic |
| **Developer** | Implements exactly per the architect's plan, follows this file's conventions, writes/updates tests, runs the full `compile`/`lint`/`test` loop | Skip tests, deviate from the plan without flagging it back |
| **QA** | Independently verifies the implementation against the spec + plan, runs `npm run compile`/`lint`/`test`, checks edge cases and OWASP-style security issues, reports pass/fail | Fix code itself — issues go back to Developer |

This keeps quality intact even when most code is written by an agent: no single role can both decide *and* implement *and* verify a change without another role checking it.

**Where each role lives per tool:**

| Tool | Mechanism |
|---|---|
| GitHub Copilot (VS Code) | `.github/agents/po.agent.md`, `architect.agent.md`, `developer.agent.md`, `qa.agent.md` — pick from the agent picker, or let handoffs chain them |
| Claude Code | `.claude/agents/po.md`, `architect.md`, `developer.md`, `qa.md` — invoke with `@po`, `@architect`, etc., or ask Claude to "use the po subagent, then hand off to architect" |
| opencode | `.opencode/agents/po.md`, `architect.md`, `developer.md`, `qa.md` — invoke with `@po`, `@architect`, etc. |
| Codex CLI | Codex has no separate persona-file mechanism — follow the role definitions above manually: paste the relevant role's responsibilities into your prompt before asking Codex to act in that capacity |

Regardless of tool, never skip straight from "idea" to "Developer" for anything beyond a trivial fix — run the idea past the PO role first.
