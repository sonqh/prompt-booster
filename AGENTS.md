# PromptBooster — Agent Guidelines

This repository holds a frozen VS Code extension and the plan for an agent plugin. TypeScript, no framework.

## Project Overview

Status, from [decisions/ADR-004-plugin-first.md](decisions/ADR-004-plugin-first.md):

- The product is one agent plugin, `prompt-booster`, with one skill, `/prompt-booster:boost`. Its folder is `plugin/`. The folder does not exist yet. New work goes to the plugin.
- The VS Code extension under `src/` is frozen. It gets no feature and no new release. Version 0.2.4 is on the VS Code Marketplace.
- The chat entry `@PromptBooster` is a chat participant. VS Code deprecated chat participants. It runs only on the Local harness, which VS Code removes in February 2027.
- The Meta-MCP orchestrator is archived. No code exists for it. Its files under `docs/` are history.

The extension rewrites a raw prompt with a language model before the user sends it to Copilot. It has three operation modes: manual file boost, the realtime chat participant, and file generation. See [README.md](README.md) for the user-facing text. The sections below describe the frozen extension.

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
docs/                          # architecture diagrams + old feature specs (history)
```

## Architecture

Clean layered architecture with manual dependency injection (no reflection/decorators):

- `src/core/` — domain logic: `services/` (business logic, e.g. `PromptOptimizationService`, `MCPToolRegistry`, `WorkspaceContextGatherer`, `ReferenceResolver`), `strategies/` (one `IModeStrategy` per operation mode: Manual/Realtime/File), `models/` (LM provider interface), `prompts/` (system prompt templates).
- `src/infrastructure/` — VS Code API adapters implementing `shared/interfaces/*` (e.g. `VSCodeFileSystem` implements `IFileSystem`). The aim was to keep `vscode` API usage out of core logic. Seven core files break that rule today.
- `src/presentation/` — commands, chat participant, status bar/UI.
- `src/di/` — `Container.ts` (simple symbol-keyed service locator), `ServiceRegistry.ts` (wires every service — **register new services here**), `types.ts` (symbol constants — add new ones here).
- `src/shared/` — interfaces and types shared across layers.

**Operation modes** (`OperationMode`): `manual` (boost `.prompt.md` files on right-click), `realtime` (the chat participant `@PromptBooster`), `file` (generate `.prompt.md` from chat input). Each mode has its own `IModeStrategy` implementation under `core/strategies/`.

Core services always depend on interfaces (`ILogger`, `IFileSystem`, etc.), never concrete `infrastructure/` classes directly. Services that keep this rule are unit-testable without the `vscode` module.

See [docs/architecture_diagrams.md](docs/architecture_diagrams.md) for diagrams. [implementation_plan.md](implementation_plan.md) and [docs/](docs/) are history.

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
- Add no new `vscode` import in `src/core/**`. Go through an `infrastructure/` adapter. Seven files in `src/core` break this rule today. Do not write that core code is free of `vscode`.
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

## Specs and workflow

The design source of truth is the OpenSpec tree, managed with the `spec-ctx` CLI. See [decisions/ADR-001-adopt-spec-ctx.md](decisions/ADR-001-adopt-spec-ctx.md). The files under `docs/`, `implementation_plan.md`, and `walkthrough.md` are history. Do not edit them and do not put a new design there.

Commands: `specctx` is `npx -y spec-ctx@0.6.0`. `openspec` is `npx -y @fission-ai/openspec@2.1.0`.

- **Main specs:** `openspec/specs/<capability>/spec.md`. They state only behavior that the code has today. All nine describe the frozen extension. One folder per capability: ENH `prompt-enhancement-pipeline`, CHAT `chat-participant-realtime-mode`, BOOST `manual-boost-mode`, FILE `file-prompt-mode`, CFG `extension-settings-and-commands`, DISC `mcp-tool-discovery`, INJ `mcp-tool-injection`, PROBE `mcp-probe-security`, FBK `prompt-feedback-learning`.
- **Changes:** `openspec/changes/<NNN-name>/` holds `proposal.md`, `design.md`, `tasks.md`, and delta specs. Work that is not done lives here, never in a main spec.
  Active changes, in this order: `001-repo-honesty`, `002-plugin-spike`, `003-boost-skill-plugin`, `004-evidence-and-release`. The direction is in [decisions/ADR-004-plugin-first.md](decisions/ADR-004-plugin-first.md): the product is one agent plugin with one skill, `/prompt-booster:boost`, in `plugin/`. The VS Code extension under `src/` is frozen. Do not add a feature to it.
- **Parked designs:** `openspec/parked/` holds designs with no open task: the MCP v2 closeout (golden set, fingerprint fix, trust gate), the operation-mode removal, the Marketplace launch, the old release hygiene, the host-neutral core, and the old Claude Code plugin port (history). Do not work on them. See `openspec/parked/README.md`.
- **Decisions:** `decisions/ADR-NNN-*.md`. ADR-004 supersedes ADR-003 in part. Do not write that `src/core` has no `vscode` import. Seven core files import it.
- **IDs:** a requirement is `REQ-<CAP>-NNN`. A scenario is `SCN-<CAP>-NNN-n`. An ID never changes. Get a new one from `specctx id new REQ <CAP>`.

Read context with the CLI. Do not read `openspec/specs/` file by file:

```bash
specctx status                                  # active changes, next task, open questions
specctx context 001/1.1                         # all that one task needs
specctx context REQ-INJ-001                     # one requirement with its code and tests
specctx context src/core/services/ToolAffinityClassifier.ts   # the requirements that a file implements
```

The task loop:

1. `specctx task next` names the next open task.
2. `specctx task start <task>` prints its context. Read it before you edit.
3. Do the work. Follow the conventions above.
4. `specctx task done <task>` runs the `Verify:` command of the task. It sets the checkbox and writes evidence only on exit code 0. Never edit a checkbox by hand.
5. After each task group, run `specctx check --strict` and `openspec validate --all --strict`.
6. At the end of a session, run `specctx handoff write`.

Tags link code and tests to requirements:

- Put `// REQ-<CAP>-NNN` on the line above the class or function that implements a requirement.
- Put `// Covers: REQ-<CAP>-NNN` and the scenario IDs (`// SCN-<CAP>-NNN-n`) on the lines above the test that proves it.
- When you move code, move its tag with it. `specctx check --strict` reports a main requirement that no test covers.
- `.ctx/baseline.json` lists the requirements that had no test on 2026-11-18. The list can only shrink. Run `specctx baseline prune` after you add a test.

Open owner questions are in `.ctx/questions.json`. Do not start work that depends on an open question. Tasks marked `(owner)` need a person. Prepare the file, then stop and ask. The spike, the A/B run, the tag, and the awesome-copilot pull request are owner work.
