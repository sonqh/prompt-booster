# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-PROBE-001 Opt-in and off the request path
The probe SHALL run only inside `promptBooster.refreshMcpIndex`, only when `promptBooster.mcp.probeServers` is true, and only in a trusted workspace. The default SHALL be false. One refresh SHALL probe at most 10 servers. No code on the chat request path, at activation, or on a config change SHALL call the probe. The setting description in the manifest SHALL say that the probe runs only from the command.

Refs: ADR-002, ADR-003

#### Scenario: SCN-PROBE-001-1 The setting is off
- **WHEN** `mcp.probeServers` is false and the refresh command runs
- **THEN** no server process starts and the message names the setting that turns probing on

#### Scenario: SCN-PROBE-001-2 An untrusted workspace
- **WHEN** `mcp.probeServers` is true, the workspace is not trusted, and the refresh command runs
- **THEN** the transport is not called and the message says that probing needs a trusted workspace

#### Scenario: SCN-PROBE-001-3 The setting text
- **WHEN** a reader opens the description of `promptBooster.mcp.probeServers`
- **THEN** it does not name activation or a config change

## ADDED Requirements

### Requirement: REQ-PROBE-007 Secret fields are not retained
The registry SHALL keep only `command`, `args`, `env`, `disabled`, and `tools` of a server config. `env` SHALL leave it only through `getProbeTargets`. `getCatalogFingerprint` SHALL return a SHA-256 hex digest whose input holds no `env` or `headers` value. No such value SHALL be in a catalog entry, a log line, workspace state, a written file, the feedback report, or the optimizer input.

Refs: REQ-PROBE-004, REQ-DISC-008, REQ-FBK-001

#### Scenario: SCN-PROBE-007-1 The fingerprint is a digest
- **WHEN** `mcp.servers` holds a server with `env: { TOKEN: "CANARY-SECRET" }` and the catalog refreshes
- **THEN** `getCatalogFingerprint` is 64 hex characters and does not hold `CANARY-SECRET`

#### Scenario: SCN-PROBE-007-2 The canary
- **WHEN** a config holds `CANARY-SECRET` in `env` and in `headers`, and discovery, a refresh, an enhancement, the report command, and the export command run
- **THEN** no logger line, no workspace state value, no written file, and no optimizer input holds `CANARY-SECRET`

#### Scenario: SCN-PROBE-007-3 Only a secret changes
- **WHEN** only an `env` value in `mcp.servers` changes
- **THEN** the fingerprint stays the same

#### Scenario: SCN-PROBE-007-4 A command changes
- **WHEN** the `command` of a server in `mcp.servers` changes
- **THEN** the fingerprint changes

### Requirement: REQ-PROBE-008 Probe setting scope
`promptBooster.mcp.probeServers` SHALL have the scope `machine` in the manifest, so a workspace settings file cannot set it. The manifest SHALL list it under `capabilities.untrustedWorkspaces.restrictedConfigurations`.

#### Scenario: SCN-PROBE-008-1 A workspace settings file
- **WHEN** `.vscode/settings.json` of a cloned repository sets `promptBooster.mcp.probeServers` to true
- **THEN** `getMcpProvisioningOptions().probeServers` stays false
