# extension-settings-and-commands Specification

## Purpose
The settings, palette commands, status bar item, and activation steps of the extension. Each requirement names a command or a setting that has a handler or a reader in the code today.

## Requirements

### Requirement: REQ-CFG-001 Switch operation mode
`promptBooster.switchMode` SHALL show a quick pick with `Manual Mode`, `Real-time Mode`, and `File Mode`. A pick SHALL write `promptBooster.operationMode` to the global settings and show a confirmation. No pick SHALL change nothing.

#### Scenario: SCN-CFG-001-1 The user picks File Mode
- **WHEN** the user picks `File Mode`
- **THEN** `promptBooster.operationMode` is `file` in the global settings

### Requirement: REQ-CFG-002 Model selection
`promptBooster.switchModel` SHALL write `promptBooster.modelPreference` from a quick pick of `gpt-4.1`, `gpt-4o`, and `claude-haiku-4.5`. `LanguageModelProvider` SHALL list the Copilot chat models. It SHALL use the last picked model when it is still listed. If not, it SHALL use the first model whose id contains the preference, with dashes ignored. With no match, `getModel` SHALL show a picker, and `getModelAutomatically` SHALL take the first model that is not a slow model.

#### Scenario: SCN-CFG-002-1 The preference matches
- **WHEN** the preference is `gpt-4o` and Copilot lists a model with the id `gpt-4o`
- **THEN** both model calls return that model and show no picker

#### Scenario: SCN-CFG-002-2 No match in a chat request
- **WHEN** the preference matches no listed model and the list holds `gpt-5` and `gpt-4.1`
- **THEN** `getModelAutomatically` returns `gpt-4.1`

### Requirement: REQ-CFG-003 Toggle auto-optimization
`promptBooster.toggleAutoOptimization` SHALL invert `promptBooster.autoOptimize` in the global settings and show the new state.

#### Scenario: SCN-CFG-003-1 Toggle from off
- **WHEN** `autoOptimize` is false and the command runs
- **THEN** `autoOptimize` is true and the message says `Auto-optimization enabled`

### Requirement: REQ-CFG-004 Status bar item
The extension SHALL show one status bar item on activation. With `simplifiedContextMode` on, the item SHALL read `PromptBooster` and have no command. With it off, the item SHALL show the icon and name of the operation mode at creation time and run `promptBooster.switchMode` on a click.

#### Scenario: SCN-CFG-004-1 Simplified mode
- **WHEN** the extension activates with `simplifiedContextMode` on
- **THEN** the status bar item reads `$(rocket) PromptBooster` and a click runs no command

### Requirement: REQ-CFG-005 Feature settings and defaults
`ConfigurationManager` SHALL read these settings with these defaults: `mcp.probeServers` false, `mcp.includeForeignServers` false, `mcp.cacheTtlMinutes` 10, `feedback.enabled` true, `feedback.historyLimit` 200, `cache.enabled` true, `cache.ttlDays` 7, `cache.maxEntries` 200, `learning.fewShotFromFeedback` false, `learning.maxFewShotExamples` 5, `learning.fewShotCharBudget` 2000. The manifest SHALL declare the same defaults.

Refs: ADR-002

#### Scenario: SCN-CFG-005-1 A fresh install
- **WHEN** the user has set no PromptBooster setting
- **THEN** `getMcpProvisioningOptions` returns `probeServers: false` and `includeForeignServers: false`, and `getFeedbackLearningOptions` returns `fewShotFromFeedback: false`

### Requirement: REQ-CFG-006 Activation
On `onStartupFinished` the extension SHALL build the service container, register the commands, the status bar item, a code lens provider for `**/*.prompt.md`, and the chat participant. It SHALL start `ensureCatalog` without waiting for it and log a warning when it fails. It SHALL dispose the config watcher with the extension. It SHALL show a welcome message until the user dismisses it once.

Refs: REQ-DISC-007

#### Scenario: SCN-CFG-006-1 The MCP warm-up fails
- **WHEN** `ensureCatalog` rejects during activation
- **THEN** the logger records `MCP catalog warm-up failed` and activation completes
