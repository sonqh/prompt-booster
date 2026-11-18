# Spec Delta

## ADDED Requirements

### Requirement: REQ-CFG-009 One model default
The fallback value for `modelPreference` in `ConfigurationManager` SHALL equal the default in the manifest. The value SHALL be `claude-haiku-4.5`.

Refs: REQ-CFG-002

#### Scenario: SCN-CFG-009-1 The two defaults
- **WHEN** a reader compares the manifest default with the code fallback
- **THEN** both are `claude-haiku-4.5`

### Requirement: REQ-CFG-010 Permission controls
`promptBooster.configurePermissions` SHALL offer `Allow`, `Revoke`, and `Reset (ask again)`. `Allow` SHALL store `permissionGranted = true` in global state. `Revoke` SHALL store `false`. `Reset` SHALL clear the value, and the next chat request SHALL show the permission dialog again.

Refs: REQ-CHAT-003

#### Scenario: SCN-CFG-010-1 Reset after Never
- **WHEN** the user picked `Never`, then runs the command and picks `Reset (ask again)`
- **THEN** `permissionGranted` is unset and `hasPermission` shows the dialog again

#### Scenario: SCN-CFG-010-2 Revoke
- **WHEN** permission is granted and the user picks `Revoke`
- **THEN** `hasPermission` returns false with no dialog
