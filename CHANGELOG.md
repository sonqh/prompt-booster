# Change Log

All notable changes to the "PromptBooster" extension will be documented in this file.

## [Unreleased]

### Changed

- The VS Code extension is frozen. It gets no feature and no new release. Version 0.2.4 stays on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=promptbooster.promptbooster).
- Reason: VS Code deprecated chat participants. A chat participant does not run on the Copilot harness. It runs only on the Local harness, and VS Code removes the Local harness in February 2027. See https://code.visualstudio.com/api/extension-guides/ai/chat
- The product moves to an agent plugin with one skill, `/prompt-booster:boost`. The plugin does not exist yet. See [decisions/ADR-004-plugin-first.md](decisions/ADR-004-plugin-first.md).
- Manifest: `capabilities.untrustedWorkspaces.supported` is `false`. VS Code does not activate the extension in an untrusted workspace.
- Manifest: `promptBooster.mcp.probeServers` has the scope `machine`. A workspace settings file cannot turn the probe on. The description says that the probe runs only from the `Refresh MCP Tool Index` command.
- Manifest: the `description` starts with `Legacy (Local harness only):`.
- The `version` stays `0.2.4`.

### Added

- `LICENSE` holds the full MIT License text.
- A CI workflow at `.github/workflows/ci.yml` runs compile, lint, `specctx check --strict`, and `openspec validate --all --strict`. The Electron tests run in a step that does not block.
- The design moved to an OpenSpec tree with spec-ctx IDs (`openspec/`, `decisions/`).

## [0.2.4] - 2026-02-22

The version changed to 0.2.4 on 2026-02-22. The commits of 2026-03-09 and of 2026-09-06 to 2026-09-09 did not change the version. This entry holds them too. Version 0.2.4 is on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=promptbooster.promptbooster).

### Fixed

- Model preference matching normalizes hyphens (2026-02-22).

### Added

- Tool-aware transformation and MCP-aware tool provisioning: `MCPToolRegistry`, `ToolAffinityClassifier`, `WorkspaceContextGatherer`, and `ReferenceResolver`, with tests for the registry and the classifier (2026-03-09).
- MCP discovery ports and hermetic test foundations (Phase A, 2026-09-06).
- `MCPToolRegistry` v2 with ports, tagging, and a fingerprint cache (Phase B, 2026-09-06).
- MCP tool acquisition from the runtime, a probe, and a manual index (Phase C, 2026-09-06).
- Scorer v2 and injection gating (Phase D, 2026-09-06).
- Acceptance-based feedback capture (Phase E1, 2026-09-06).
- Optimizer response cache with LRU and TTL that tolerates corrupt entries (Phase E2, 2026-09-09).
- Learning store, few-shot promotion, and the feedback report (Phase E3, 2026-09-09).
- ESLint config. The `lint` script passes (2026-09-09).
- `AGENTS.md`, `CLAUDE.md`, and the PO, Architect, Developer, and QA agent personas (2026-09-06).

### Changed

- `RealtimeModeStrategy` and the system prompts use the discovered tools (2026-03-09).
- The new command contributions have no `category` field (2026-09-09).
- README refresh for MCP-aware provisioning v2 (2026-09-09).

## [0.2.3] - 2026-02-19

### Fixed

- Model switching in `LanguageModelProvider` and `ChatParticipantHandler`.

### Changed

- The default of `promptBooster.modelPreference` is `claude-haiku-4.5`. It was `gpt-4.1`.

## [0.2.2] - 2026-02-18

### Added

- **Context-Aware Optimization**: References to files (e.g., `#file:utils.ts`) are now fully read and included in the optimization context, allowing the AI to see the code it is working on.
- **Simplified Context Mode**: The extension now automatically determines the best mode based on context. Chat interactions always use Real-time optimization, while Editor commands use Manual mode. No more manual switching required.
- **Intent Indicators**: Chat responses now show a visual indicator (`Detected Intent: ASK` or `EDIT`) to explain why specific actions were suggested.

### Changed

- **UX Improvements**: Renamed buttons for clarity (`Apply to Chat`, `Ask in Chat`) and improved tooltips.
- **System Prompt**: logic extraction for better maintainability.
- **Robust JSON Parsing**: Improved resilience against malformed AI responses during optimization.

## [0.2.1] - 2026-02-17

### Added

- **Build Output Configuration**: Added `npm run package` script to build VSIX in dedicated `dist/` folder
- **Git Ignore Configuration**: Added `*.vsix` and `dist/` to `.gitignore` to prevent build artifacts from being tracked

## [0.2.0] - 2026-02-10

### Added

#### Architectural Migration (Clean Architecture)

- **Dependency Injection**: Implemented a central DI container for managing services and commands.
- **Layered Structure**: Reorganized codebase into Presentation, Core, and Infrastructure layers.
- **Service Abstractions**: Decoupled business logic from VS Code API via interfaces (`ILogger`, `IFileSystem`, `IConfigurationManager`).
- **Strategy Pattern**: Implemented Mode strategies (Manual, Realtime, FileMode) for better extensibility.
- **Command Registry**: Centralized command registration for a cleaner entry point.

#### Mode 2: Real-time (Chat Interception)

- **Chat Interception**: Automatically intercept prompts starting with `@PromptBooster`.
- **Smart Intent Detection**: Automatically detects user intent (Ask vs Edit) using AI.
- **Dynamic Context-Aware Buttons**: Different actions available based on detected intent (`Apply Edits`, `Ask Copilot`, `Refine in File`).
- **Structured Optimization**: Rewrites prompts into a formal structure (Task, Context, Requirements, Output).

#### Mode 3: File Generation (Refinement Workflow)

- **Automated Generation**: Creates `.prompt.md` files in `.github/prompts/` from chat prompts.
- **Naming Strategies**: Support for timestamp, prompt-based, and custom file naming.
- **Processing Workflow**: Integrated CodeLens and status bar buttons to send refined prompts back to Copilot.

#### New Features & UI

- **Switch AI Model Command**: New command to switch between preferred AI models (GPT-4.1, GPT-4o, Claude Haiku).
- **ESM Compliance**: Updated all imports to use `.js` extensions for Node16 module resolution compatibility.

#### Testing

- **Unit Testing**: Added test suite for `PromptOptimizationService` using Mocha.
- **Mocks**: Integrated mock objects for Logger and AI Model testing.

### Fixed

- **Module Resolution**: Resolved "Cannot find module" errors by strictly following ESM path rules.
- **Circular Dependencies**: Fixed potential circular dependencies through DI container usage.

### Changed

- **Entry Point Refactoring**: Reduced `extension.ts` size by 70%, moving logic to dedicated controllers and handlers.
- **Configuration Management**: Centralized all settings access via the `ConfigurationManager` service.

## [0.1.0] - 2026-02-05

### Planned Features

- Webview-based diff preview for Mode 2
- Prompt history and library
- Template system for common tasks
- Caching and performance optimizations
- Unit and integration tests

---

## Version Support

- **VS Code**: 1.99.0 or higher
- **GitHub Copilot**: Required for Language Model API access
- **Node.js**: 20.x or higher
- **TypeScript**: 5.3.0 or higher
