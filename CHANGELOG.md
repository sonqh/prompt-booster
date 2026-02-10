# Change Log

All notable changes to the "PromptBooster" extension will be documented in this file.

## [0.1.0] - 2026-02-05

### Added

#### Core Infrastructure

- Initial project setup with TypeScript and VS Code extension framework
- Configuration management system with `ModeManager` class
- Three operational modes: Manual, Real-time (stub), and File (stub)
- Language model selection with fallback logic
- Status bar UI showing current mode with quick mode switcher

#### Mode 1: Manual Enhancement

- Right-click context menu integration
- Editor title menu integration
- Support for selection or full document optimization
- Progress indicator with cancellation support
- Comprehensive error handling
- Output channel logging for debugging

#### Settings

- `promptBooster.operationMode` - Choose operation mode (manual/realtime/file)
- `promptBooster.autoOptimize` - Toggle automatic optimization
- `promptBooster.showPreview` - Show preview UI (for future modes)
- `promptBooster.fileOutputDirectory` - Output directory for generated files
- `promptBooster.fileNamingPattern` - File naming strategy
- `promptBooster.modelPreference` - Preferred AI model selection

#### Commands

- `PromptBooster: Boost This Prompt` - Optimize prompt in current file
- `PromptBooster: Switch Operation Mode` - Quick mode switcher
- `PromptBooster: Toggle Auto-Optimization` - Enable/disable auto-optimization
- `PromptBooster: Configure Permissions` - Manage interception permissions
- `PromptBooster: Process Prompt File` - Process generated files (stub)

#### Developer Experience

- Full TypeScript strict mode compliance
- VS Code debugging configuration
- Build tasks and watch mode
- Comprehensive code comments and documentation

### Coming Soon

#### Mode 2: Real-time Chat Interception

- Automatic prompt interception
- Preview UI with before/after comparison
- Edit capability before submission
- Permission management system

#### Mode 3: File Generation

- Generate `.prompt.md` files from chat prompts
- Full editor support for refinement
- Process button and CodeLens integration
- Version control friendly workflow

## [Unreleased]

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
