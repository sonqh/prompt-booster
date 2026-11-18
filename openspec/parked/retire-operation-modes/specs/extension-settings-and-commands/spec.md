# Spec Delta

## REMOVED Requirements

### Requirement: REQ-CFG-001 Switch operation mode
**Reason**: No code selects behavior by `operationMode`. The setting and its command are removed.
**Migration**: None. Chat enhancement runs on `@PromptBooster`, and Boost runs from the editor, with no mode.

### Requirement: REQ-CFG-003 Toggle auto-optimization
**Reason**: `autoOptimize` had an effect only together with `operationMode` and `simplifiedContextMode`, which are removed.
**Migration**: To stop enhancement, do not address `@PromptBooster`, or pick `Revoke` in `PromptBooster: Configure Permissions`.

## MODIFIED Requirements

### Requirement: REQ-CFG-004 Status bar item
The extension SHALL show one status bar item on activation. The item SHALL read `PromptBooster` with the rocket icon and SHALL have no command.

#### Scenario: SCN-CFG-004-1 Simplified mode
- **WHEN** the extension activates, with any settings
- **THEN** the status bar item reads `$(rocket) PromptBooster` and a click runs no command

## ADDED Requirements

### Requirement: REQ-CFG-007 Declared commands have handlers
Each command in `contributes.commands` of the manifest SHALL be registered during activation. The manifest SHALL not declare `promptBooster.testFileGeneration`, `promptBooster.testRealtimeMode`, `promptBooster.switchMode`, or `promptBooster.toggleAutoOptimization`.

Refs: REQ-REL-007

#### Scenario: SCN-CFG-007-1 The palette
- **WHEN** the user runs any `PromptBooster:` entry of the Command Palette
- **THEN** VS Code finds a handler for it

#### Scenario: SCN-CFG-007-2 The release check
- **WHEN** `node scripts/check-release.mjs --rule commands` runs
- **THEN** it exits 0

### Requirement: REQ-CFG-008 Declared settings are read
Each `promptBooster.*` setting in the manifest SHALL be read by product code and SHALL change behavior. The manifest SHALL not declare `operationMode`, `simplifiedContextMode`, `autoOptimize`, or `showPreview`.

Refs: REQ-REL-007

#### Scenario: SCN-CFG-008-1 The removed settings
- **WHEN** a reader searches `package.json` and `src/` for the four removed setting names
- **THEN** no match exists

#### Scenario: SCN-CFG-008-2 The release check
- **WHEN** `node scripts/check-release.mjs --rule settings` runs
- **THEN** it exits 0
