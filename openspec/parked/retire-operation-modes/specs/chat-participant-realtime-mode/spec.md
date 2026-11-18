# Spec Delta

## REMOVED Requirements

### Requirement: REQ-CHAT-002 Run gate
**Reason**: The gate read `simplifiedContextMode`, `operationMode`, and `autoOptimize`. All three settings are removed, so no gate is left. REQ-CHAT-008 states the new rule.
**Migration**: Move the code tag and the test tag from REQ-CHAT-002 to REQ-CHAT-008. To stop enhancement, pick `Revoke` in `PromptBooster: Configure Permissions`.

## ADDED Requirements

### Requirement: REQ-CHAT-008 Run on every request
The participant SHALL run the strategy for every request that addresses `@PromptBooster`. No setting SHALL stop the run. The permission gate and the model gate SHALL still apply.

Refs: REQ-CHAT-003, REQ-CHAT-004

#### Scenario: SCN-CHAT-008-1 A request with default settings
- **WHEN** a user with granted permission sends `@PromptBooster fix the bug`
- **THEN** the optimizer is called one time and the stream holds no notice about a mode or about auto-optimization

#### Scenario: SCN-CHAT-008-2 An old settings file
- **WHEN** the settings file of the user still holds `promptBooster.autoOptimize: false` or `promptBooster.operationMode: "manual"`
- **THEN** the participant runs as for a user with default settings

## MODIFIED Requirements

### Requirement: REQ-CHAT-003 Permission gate
`RealtimeModeStrategy` SHALL call `hasPermission` before it selects a model. With no stored decision, `hasPermission` SHALL show a modal dialog with `Allow`, `Not Now`, and `Never`. `Allow` SHALL store `permissionGranted = true` in global state. `Never` SHALL store `false`. `Not Now` SHALL store nothing. Without permission the strategy SHALL print `Permission required to optimize prompts` and call no model.

#### Scenario: SCN-CHAT-003-1 Permission is granted
- **WHEN** permission is granted
- **THEN** the strategy calls the optimizer and the stream holds `**Optimized Prompt**`

#### Scenario: SCN-CHAT-003-2 The user picks Never
- **WHEN** the user picks `Never` in the dialog
- **THEN** global state holds `permissionGranted = false` and later requests print the permission notice with no dialog
