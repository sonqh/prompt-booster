# Spec Delta

## Purpose
The rule that core and shared code run with no VS Code host, and the checks that keep the rule true. A second host, such as the Claude Code plugin, can then use the same core code.

## ADDED Requirements

### Requirement: REQ-CORE-001 No vscode import in core
No file under `src/core/**` SHALL import the `vscode` module, as a value or as a type.

#### Scenario: SCN-CORE-001-1 A search of core
- **WHEN** a search for an import of `vscode` runs on `src/core`
- **THEN** it finds no file

### Requirement: REQ-CORE-002 Host-neutral shared contracts
No file under `src/shared/**` SHALL import `vscode`. `IStateRepository` SHALL be declared in `src/shared/interfaces/`. `IFileSystem` SHALL take string paths only. `CopilotTool` SHALL be declared in a file with no host type. Cancellation SHALL use a token interface that is declared in `src/shared/interfaces/`.

#### Scenario: SCN-CORE-002-1 A search of shared
- **WHEN** a search for an import of `vscode` runs on `src/shared`
- **THEN** it finds no file

#### Scenario: SCN-CORE-002-2 The state port
- **WHEN** a core service needs workspace state
- **THEN** it imports `IStateRepository` from `src/shared/interfaces/` and from no file under `src/infrastructure`

### Requirement: REQ-CORE-003 Host-neutral model port
`ILanguageModelProvider` SHALL return a chat model interface that is declared in core and names no VS Code type. `PromptOptimizationService` SHALL send the system prompt and the input through that interface. A cancelled call SHALL give the error `Optimization cancelled by user`, as today.

Refs: REQ-ENH-001

#### Scenario: SCN-CORE-003-1 A fake model in plain Node
- **WHEN** a test gives `PromptOptimizationService` a fake model that yields `{"intent":"edit","enhancedPrompt":"X"}` and runs with no VS Code host
- **THEN** the result has intent `edit` and enhanced prompt `X`

### Requirement: REQ-CORE-004 Host code lives outside core
Code that reads the editor, the workspace, or the chat stream SHALL live under `src/infrastructure` or `src/presentation`. Core SHALL reach it through ports. The assembly of the optimizer input, the response cache step, the few-shot step, and feedback capture SHALL live in core and SHALL have no UI text.

Refs: REQ-ENH-007

#### Scenario: SCN-CORE-004-1 The pipeline in plain Node
- **WHEN** a test runs the enhancement pipeline with mock ports and with no VS Code host
- **THEN** it returns the optimizer input, the enhanced prompt, the intent, and the tool lists

#### Scenario: SCN-CORE-004-2 The same output
- **WHEN** the existing strategy tests run after the move
- **THEN** each test passes with no change to its assertions

### Requirement: REQ-CORE-005 Unit tests with no Electron
`npm run test:unit` SHALL run the tests of pure core code in plain Node with mocha. It SHALL fail when a file that it loads requires `vscode`. CI SHALL run it.

#### Scenario: SCN-CORE-005-1 A clean clone
- **WHEN** `npm ci && npm run compile && npm run test:unit` runs on a machine with no display
- **THEN** the tests pass and no VS Code download starts

#### Scenario: SCN-CORE-005-2 A leak
- **WHEN** a core file gains an import of `vscode`
- **THEN** `npm run test:unit` fails

### Requirement: REQ-CORE-006 Lint guard
ESLint SHALL report an error for an import of `vscode` in a file under `src/core/**` or `src/shared/**`.

#### Scenario: SCN-CORE-006-1 A new import
- **WHEN** a developer adds `import * as vscode from "vscode"` to a core file
- **THEN** `npm run lint` fails
