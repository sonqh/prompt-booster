# PromptBooster Architecture Diagrams

## Current Architecture Overview

```mermaid
graph TD
    subgraph "Entry Point"
        EXT[extension.ts<br/>320 lines]
    end

    subgraph "Core Logic"
        OPT[PromptOptimizer<br/>promptBooster.ts]
    end

    subgraph "Modes"
        MANUAL[ManualMode]
        REALTIME[RealtimeMode]
        FILE[FileMode]
    end

    subgraph "Infrastructure"
        CONFIG[ModeManager<br/>settings.ts]
        MODEL[LanguageModelSelector]
    end

    subgraph "UI Components"
        STATUS[ModeStatusBar]
        BUTTON[ProcessButton]
        LENS[CodeLensProvider]
    end

    subgraph "Commands"
        CHAT[ChatCommands]
    end

    subgraph "VS Code API"
        VSCODE[vscode module]
    end

    EXT --> OPT
    EXT --> MANUAL
    EXT --> REALTIME
    EXT --> FILE
    EXT --> CONFIG
    EXT --> MODEL
    EXT --> STATUS
    EXT --> BUTTON
    EXT --> LENS
    EXT --> CHAT

    MANUAL --> OPT
    MANUAL --> MODEL
    REALTIME --> OPT
    REALTIME --> MODEL
    REALTIME --> CONFIG
    FILE --> CONFIG
    CHAT --> FILE
    STATUS --> CONFIG
    BUTTON --> CONFIG

    OPT --> VSCODE
    MANUAL --> VSCODE
    REALTIME --> VSCODE
    FILE --> VSCODE
    CONFIG --> VSCODE
    MODEL --> VSCODE
    STATUS --> VSCODE
    BUTTON --> VSCODE
    CHAT --> VSCODE

    style EXT fill:#f96,stroke:#333,stroke-width:4px
    style VSCODE fill:#ff9,stroke:#333,stroke-width:2px
```

### Issues with Current Architecture

- **God Object**: `extension.ts` knows about everything
- **Tight Coupling**: Every component directly depends on VS Code API
- **No Abstraction**: No interfaces or dependency injection
- **Testing Difficulty**: Hard to test in isolation

---

## Architecture Overview

```mermaid
graph TD
    subgraph "Presentation Layer"
        EXT[extension.ts]
        CMD[CommandRegistry]
        BOOST[BoostCommand]
        SWITCH[SwitchModeCommand]
        CHAT_CMD[ChatCommand]
        STATUS_UI[StatusBarController]
        BUTTON_UI[ProcessButtonController]
        PARTICIPANT[ChatParticipantHandler]
    end

    subgraph "Core Domain Layer"
        OPT_SVC[PromptOptimizationService]
        MANUAL_STRAT[ManualModeStrategy]
        RT_STRAT[RealtimeModeStrategy]
        FILE_STRAT[FileModeStrategy]
        MODEL_PROV[LanguageModelProvider]
    end

    subgraph "Infrastructure Layer"
        CONFIG_MGR[ConfigurationManager]
        STATE_REPO[StateRepository]
        LOGGER[VSCodeOutputLogger]
        FS[VSCodeFileSystem]
        WS[VSCodeWorkspaceAdapter]
    end

    subgraph "Shared"
        IFACES[Interfaces<br/>ILogger, IConfig, etc.]
    end

    subgraph "DI Container"
        CONTAINER[ServiceContainer]
        REGISTRY[ServiceRegistry]
    end

    subgraph "VS Code API"
        VSCODE[vscode module]
    end

    EXT --> CONTAINER
    CONTAINER --> REGISTRY
    CONTAINER --> CMD
    CONTAINER --> PARTICIPANT

    CMD --> BOOST
    CMD --> SWITCH
    CMD --> CHAT_CMD

    BOOST -.-> MANUAL_STRAT
    CHAT_CMD -.-> FILE_STRAT
    PARTICIPANT -.-> RT_STRAT

    MANUAL_STRAT --> OPT_SVC
    RT_STRAT --> OPT_SVC
    FILE_STRAT --> OPT_SVC

    OPT_SVC --> MODEL_PROV

    MANUAL_STRAT --> IFACES
    RT_STRAT --> IFACES
    FILE_STRAT --> IFACES
    OPT_SVC --> IFACES
    MODEL_PROV --> IFACES

    CONFIG_MGR --> VSCODE
    STATE_REPO --> VSCODE
    LOGGER --> VSCODE
    FS --> VSCODE
    WS --> VSCODE
    MODEL_PROV --> VSCODE

    STATUS_UI --> CONFIG_MGR
    BUTTON_UI --> CONFIG_MGR

    style EXT fill:#9f9,stroke:#333,stroke-width:4px
    style CONTAINER fill:#99f,stroke:#333,stroke-width:3px
    style IFACES fill:#f9f,stroke:#333,stroke-width:2px
    style VSCODE fill:#ff9,stroke:#333,stroke-width:2px
```

### Benefits of Proposed Architecture

- **Layered Design**: Clear separation between presentation, domain, and infrastructure
- **Dependency Inversion**: Core depends on interfaces, not concrete implementations
- **Testability**: Core logic can be tested without VS Code
- **Extensibility**: Easy to add new modes, commands, or providers

---

## Component Dependency Flow

### Current: Tightly Coupled

```mermaid
graph LR
    A[ManualMode] --> B[PromptOptimizer]
    A --> C[LanguageModelSelector]
    A --> D[vscode.OutputChannel]
    A --> E[vscode.window]
    A --> F[vscode.workspace]

    B --> D
    B --> E
    B --> F

    C --> D
    C --> E
    C --> F

    style A fill:#f96
    style B fill:#f96
    style C fill:#f96
```

**Problems:**

- Direct VS Code API dependencies everywhere
- Impossible to test without VS Code environment
- No abstraction boundaries

### Proposed: Dependency Inversion

```mermaid
graph LR
    subgraph "Presentation"
        CMD[BoostCommand]
    end

    subgraph "Core Domain"
        STRAT[ManualModeStrategy]
        OPT[IPromptOptimizationService]
        MODEL[ILanguageModelProvider]
        LOG[ILogger]
    end

    subgraph "Infrastructure"
        OPT_IMPL[PromptOptimizationService]
        MODEL_IMPL[LanguageModelProvider]
        LOG_IMPL[VSCodeOutputLogger]
        VSCODE[vscode API]
    end

    CMD --> STRAT
    STRAT --> OPT
    STRAT --> MODEL
    STRAT --> LOG

    OPT_IMPL -.implements.-> OPT
    MODEL_IMPL -.implements.-> MODEL
    LOG_IMPL -.implements.-> LOG

    OPT_IMPL --> VSCODE
    MODEL_IMPL --> VSCODE
    LOG_IMPL --> VSCODE

    style STRAT fill:#9f9
    style OPT fill:#99f
    style MODEL fill:#99f
    style LOG fill:#99f
```

**Benefits:**

- Core depends only on interfaces
- Infrastructure adapts VS Code to interfaces
- Easy to mock for testing
- Can swap implementations

---

## Data Flow: Manual Mode Boost

### Current Flow

```mermaid
sequenceDiagram
    participant User
    participant extension.ts
    participant ManualMode
    participant PromptOptimizer
    participant LanguageModelSelector
    participant vscode.lm

    User->>extension.ts: Execute "boost" command
    extension.ts->>ManualMode: boost(uri)
    ManualMode->>LanguageModelSelector: selectModel()
    LanguageModelSelector->>vscode.lm: selectChatModels()
    vscode.lm-->>LanguageModelSelector: models[]
    LanguageModelSelector->>vscode.window: showQuickPick()
    vscode.window-->>LanguageModelSelector: selected model
    LanguageModelSelector-->>ManualMode: model
    ManualMode->>PromptOptimizer: optimizeWithProgress()
    PromptOptimizer->>vscode.window: withProgress()
    PromptOptimizer->>vscode.lm: sendRequest()
    vscode.lm-->>PromptOptimizer: optimized text
    PromptOptimizer-->>ManualMode: result
    ManualMode->>vscode.workspace: applyEdit()
    ManualMode->>vscode.window: showInformationMessage()
```

### Proposed Flow

```mermaid
sequenceDiagram
    participant User
    participant BoostCommand
    participant ManualModeStrategy
    participant IPromptOptimizationService
    participant ILanguageModelProvider
    participant ILogger

    User->>BoostCommand: Execute command
    BoostCommand->>ManualModeStrategy: execute(context)
    ManualModeStrategy->>ILanguageModelProvider: getModel()
    ILanguageModelProvider-->>ManualModeStrategy: model
    ManualModeStrategy->>IPromptOptimizationService: optimize(prompt, model)
    IPromptOptimizationService->>ILogger: log("Optimizing...")
    IPromptOptimizationService-->>ManualModeStrategy: result
    ManualModeStrategy->>ILogger: log("Complete")
    ManualModeStrategy-->>BoostCommand: result
    BoostCommand->>User: Show success
```

**Benefits:**

- Cleaner flow with fewer dependencies
- All VS Code interactions abstracted
- Each component has single responsibility
- Easy to trace and debug

---

## Extension Activation Comparison

### Current Activation (320 lines)

```typescript
export function activate(context: vscode.ExtensionContext) {
  // Create outputChannel
  // Create modeManager
  // Create modelSelector
  // Create optimizer
  // Create statusBar
  // Create processButton
  // Create manualMode
  // Create fileMode
  // Create chatCommands
  // Register 8+ commands manually
  // Register CodeLens provider
  // Register chat participant
  // Handle errors
  // Show welcome message
  // Add test commands
}
```

### Proposed Activation (~30 lines)

```typescript
export function activate(context: vscode.ExtensionContext) {
  const container = createContainer(context);
  const commandRegistry = container.resolve<CommandRegistry>("commandRegistry");
  const chatParticipant =
    container.resolve<ChatParticipantHandler>("chatParticipant");

  commandRegistry.registerAll(context);
  chatParticipant.register(context);

  showWelcomeMessage(context);
}

function createContainer(context: vscode.ExtensionContext): Container {
  const container = new Container();
  ServiceRegistry.registerServices(container, context);
  return container;
}
```

---

## Testing Strategy Comparison

### Current: Difficult to Test

```typescript
// Hard to test - requires VS Code environment
class ManualMode {
  constructor(
    private optimizer: PromptOptimizer,
    private modelSelector: LanguageModelSelector,
    private outputChannel: vscode.OutputChannel,
  ) {}

  async boost(uri?: vscode.Uri) {
    const editor = vscode.window.activeTextEditor; // Can't mock
    const model = await this.modelSelector.selectModel(); // UI interaction
    // ... etc
  }
}
```

### Proposed: Easy to Test

```typescript
// Easy to test - all dependencies are interfaces
class ManualModeStrategy implements IModeStrategy {
  constructor(
    private optimizationService: IPromptOptimizationService,
    private modelProvider: ILanguageModelProvider,
    private logger: ILogger,
  ) {}

  async execute(context: ModeExecutionContext): Promise<void> {
    const model = await this.modelProvider.getModel();
    const result = await this.optimizationService.optimize(context.prompt, {
      model,
    });
    this.logger.log("Optimization complete");
    return result;
  }
}

// Unit test
describe("ManualModeStrategy", () => {
  it("should optimize prompt", async () => {
    const mockOptimizer = createMock<IPromptOptimizationService>();
    const mockModelProvider = createMock<ILanguageModelProvider>();
    const mockLogger = createMock<ILogger>();

    const strategy = new ManualModeStrategy(
      mockOptimizer,
      mockModelProvider,
      mockLogger,
    );

    await strategy.execute({ prompt: "test" });

    expect(mockOptimizer.optimize).toHaveBeenCalled();
  });
});
```

---

## Migration Path Visualization

```mermaid
gantt
    title Refactoring Timeline (5 Weeks)
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation
    Create directory structure      :2026-02-15, 2d
    Implement interfaces            :2d
    Implement infrastructure        :3d
    Setup DI container             :2d

    section Phase 2: Core
    Extract PromptOptimizationService :2026-02-22, 3d
    Implement mode strategies       :3d
    Create model provider           :2d
    Write unit tests               :2d

    section Phase 3: Presentation
    Extract commands               :2026-03-01, 3d
    Refactor UI components         :2d
    Implement CommandRegistry      :2d
    Update chat participant        :2d

    section Phase 4: Integration
    Wire DI container              :2026-03-08, 2d
    Simplify extension.ts          :1d
    End-to-end testing             :3d
    Update documentation           :2d

    section Phase 5: Cleanup
    Remove old files               :2026-03-15, 2d
    Update imports                 :1d
    Final verification             :2d
```

---

## File Count Comparison

### Current Structure

```
src/
├── commands/          (1 file)
├── config/            (1 file)
├── models/            (1 file)
├── modes/             (3 files)
├── ui/                (2 files)
├── extension.ts       (1 file)
└── promptBooster.ts   (1 file)

Total: 10 files, ~2,100 lines
```

### Proposed Structure

```
src/
├── core/
│   ├── services/      (2 files)
│   ├── models/        (2 files)
│   └── strategies/    (4 files)
├── infrastructure/
│   ├── vscode/        (3 files)
│   ├── config/        (2 files)
│   └── state/         (2 files)
├── presentation/
│   ├── commands/      (5 files)
│   ├── ui/            (3 files)
│   └── participants/  (1 file)
├── shared/
│   ├── interfaces/    (3 files)
│   ├── types/         (2 files)
│   └── utils/         (2 files)
├── di/                (3 files)
├── extension.ts       (1 file)
└── deactivate.ts      (1 file)

Total: 36 files, ~2,500 lines
```

**Trade-offs:**

- ✅ More files, but each is smaller and focused
- ✅ Better organization and discoverability
- ✅ Easier to navigate and maintain
- ⚠️ Initial learning curve for new structure

---

## Complexity Metrics

| Metric                                   | Current  | Proposed    | Change  |
| ---------------------------------------- | -------- | ----------- | ------- |
| **Cyclomatic Complexity (extension.ts)** | 45       | 5           | ⬇️ 89%  |
| **Lines per file (average)**             | 210      | 70          | ⬇️ 67%  |
| **Dependency depth**                     | 4 levels | 3 levels    | ⬇️ 25%  |
| **Test coverage**                        | ~0%      | ~80% target | ⬆️ 80%  |
| **Files in src/**                        | 10       | 36          | ⬆️ 260% |
| **Abstraction layers**                   | 0        | 3           | ⬆️ 3    |

---

## Summary

The proposed architecture transforms PromptBooster from a tightly-coupled, monolithic structure into a well-layered, testable, and extensible system. While the file count increases, each file becomes simpler, more focused, and easier to understand. The addition of proper abstractions and dependency injection enables comprehensive testing and future extensibility without breaking existing functionality.
