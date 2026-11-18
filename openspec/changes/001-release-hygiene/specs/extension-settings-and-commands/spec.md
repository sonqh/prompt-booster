# Spec Delta

## ADDED Requirements

### Requirement: REQ-CFG-007 Declared commands have handlers
Each command in `contributes.commands` of the manifest SHALL be registered during activation. The manifest SHALL not declare `promptBooster.testFileGeneration` or `promptBooster.testRealtimeMode`.

#### Scenario: SCN-CFG-007-1 The palette
- **WHEN** the user runs any `PromptBooster:` entry of the Command Palette
- **THEN** VS Code finds a handler for it

### Requirement: REQ-CFG-008 Declared settings are read
Each `promptBooster.*` setting in the manifest SHALL be read by product code. The manifest SHALL not declare `promptBooster.showPreview`, and `IConfigurationManager` SHALL have no `isShowPreviewEnabled`.

#### Scenario: SCN-CFG-008-1 The preview setting
- **WHEN** a reader searches `package.json` and `src/` for `showPreview`
- **THEN** no match exists

### Requirement: REQ-CFG-009 One model default
The fallback value for `modelPreference` in `ConfigurationManager` SHALL equal the default in the manifest. The value SHALL be `claude-haiku-4.5`.

Refs: REQ-CFG-002

#### Scenario: SCN-CFG-009-1 The two defaults
- **WHEN** a reader compares the manifest default with the code fallback
- **THEN** both are `claude-haiku-4.5`

### Requirement: REQ-CFG-010 Permission reset
`promptBooster.configurePermissions` SHALL offer `Reset permission decision`. That choice SHALL clear `permissionGranted` in global state. The next chat request SHALL show the permission dialog again.

Refs: REQ-CHAT-003

#### Scenario: SCN-CFG-010-1 After Never
- **WHEN** the user picked `Never`, then runs the command and picks `Reset permission decision`
- **THEN** `permissionGranted` is unset and the next `@PromptBooster` request shows the dialog
