# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-PROBE-001 Opt-in and off the request path
The probe SHALL run only when `promptBooster.mcp.probeServers` is true. The default SHALL be false. With the setting on, the probe SHALL run in the background after activation, after an MCP config change, and inside `promptBooster.refreshMcpIndex`. One run SHALL probe at most 10 servers, and only one run SHALL be active at a time. Activation SHALL not wait for a run. No code on the chat request path SHALL call the probe.

Refs: ADR-002

#### Scenario: SCN-PROBE-001-1 The setting is off
- **WHEN** `mcp.probeServers` is false and the refresh command runs
- **THEN** no server process starts and the message names the setting that turns probing on

#### Scenario: SCN-PROBE-001-2 Activation with the setting on
- **WHEN** the extension activates with `mcp.probeServers` true and one stub server
- **THEN** activation completes first, the server is probed one time, and its tools are in the probe cache

#### Scenario: SCN-PROBE-001-3 Activation with the setting off
- **WHEN** the extension activates with `mcp.probeServers` false
- **THEN** the transport is not called

#### Scenario: SCN-PROBE-001-4 A config change
- **WHEN** the config watcher fires three times in one second with the setting on
- **THEN** one probe run starts

## ADDED Requirements

### Requirement: REQ-PROBE-007 Secret fields are not retained
The registry SHALL keep only `command`, `args`, `env`, `disabled`, and `tools` of a server config. It SHALL drop `headers` and every other key at parse time. `env` SHALL leave the registry only through `getProbeTargets`. No `env` or `headers` value SHALL be in a catalog entry, in the manual index file, in the catalog fingerprint, in a feedback record, or in a log line.

Refs: REQ-PROBE-004, REQ-DISC-008, REQ-FBK-001

#### Scenario: SCN-PROBE-007-1 A secret in the VS Code settings
- **WHEN** `mcp.servers` holds a server with `env: { TOKEN: "s3cret" }` and the catalog refreshes
- **THEN** `getCatalogFingerprint` does not hold `s3cret`

#### Scenario: SCN-PROBE-007-2 A header in a config file
- **WHEN** `.vscode/mcp.json` holds a server with `headers: { Authorization: "Bearer abc" }`, and the refresh command writes the manual index
- **THEN** no catalog entry, no line of the index file, and no log line holds `Bearer abc`

#### Scenario: SCN-PROBE-007-3 The settings change
- **WHEN** an `env` value in `mcp.servers` changes
- **THEN** the fingerprint changes
