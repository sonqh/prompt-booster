# Change Log

All notable changes to the "PromptBooster" extension will be documented in this file.

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
- Marketplace publication

---

## Version Support

- **VS Code**: 1.99.0 or higher
- **GitHub Copilot**: Required for Language Model API access
- **Node.js**: 20.x or higher
- **TypeScript**: 5.3.0 or higher
