# mcp-probe-security Specification

## Purpose
The safety rules for the opt-in probe that starts a configured MCP server to read its tool list. It covers when the probe can run, its time limits, what it logs, and where it stores results.

## Requirements

### Requirement: REQ-PROBE-001 Opt-in and off the request path
The probe SHALL run only inside `promptBooster.refreshMcpIndex` and only when `promptBooster.mcp.probeServers` is true. The default SHALL be false. One refresh SHALL probe at most 10 servers. No code on the chat request path SHALL call the probe.

Refs: ADR-002

#### Scenario: SCN-PROBE-001-1 The setting is off
- **WHEN** `mcp.probeServers` is false and the refresh command runs
- **THEN** no server process starts and the message names the setting that turns probing on

### Requirement: REQ-PROBE-002 Probe never throws
`McpServerProbe.listServerTools` SHALL race the transport against a deadline, 6 seconds by default. A transport error, a rejection, or a timeout SHALL give `{ tools: [] }` and one warning. It SHALL drop each tool entry that has no non-empty string `name`.

#### Scenario: SCN-PROBE-002-1 The tool list arrives
- **WHEN** the transport returns two tools
- **THEN** the result holds the two tools

#### Scenario: SCN-PROBE-002-2 The transport rejects
- **WHEN** the transport rejects
- **THEN** the result is `{ tools: [] }` and the call does not throw

#### Scenario: SCN-PROBE-002-3 The transport hangs
- **WHEN** the transport never settles and the deadline is 50 ms
- **THEN** the result is `{ tools: [] }` soon after the deadline

#### Scenario: SCN-PROBE-002-4 Malformed entries
- **WHEN** the transport returns entries with no `name`
- **THEN** the result leaves them out

#### Scenario: SCN-PROBE-002-5 The default deadline
- **WHEN** the caller gives no timeout
- **THEN** the transport request carries `timeoutMs` 6000

### Requirement: REQ-PROBE-003 Transport time limits
`ChildProcessMcpTransport.listTools` SHALL start the server command, send `initialize`, then `tools/list`, as JSON lines on stdio. It SHALL end with no tools after 2 seconds with no `initialize` answer, after 3 seconds with no `tools/list` answer, at `timeoutMs`, on a process error, on an early exit, or after 4 MB of output. It SHALL kill the child process in every case. It SHALL never reject.

#### Scenario: SCN-PROBE-003-1 The server does not answer
- **WHEN** the child process writes nothing for 2 seconds
- **THEN** the call resolves `{ tools: [] }` and the child process is killed

### Requirement: REQ-PROBE-004 No secrets in logs
The probe and the transport SHALL pass `env` to the child process and SHALL write no `env` key or value to the logger. Their log lines SHALL name only the server, the command, and the failure reason. The transport SHALL discard the stderr of the child process.

Refs: ADR-002

#### Scenario: SCN-PROBE-004-1 A secret in env
- **WHEN** a probe target has `env` with a secret value and the probe succeeds, times out, and fails
- **THEN** no logger line holds the secret value

### Requirement: REQ-PROBE-005 Probe cache
Probe results SHALL be stored in workspace state under `promptbooster.mcp.probeCache`, keyed by the trimmed `command` and `args`. An entry SHALL be valid for 24 hours. The store SHALL keep at most 64 entries and drop the oldest. Corrupt state SHALL read as empty. A write error SHALL be logged and not thrown.

#### Scenario: SCN-PROBE-005-1 The same command
- **WHEN** `setProbeCache` stores tools for `node server.js` and `getProbeCache` runs for the same command and args
- **THEN** it returns the tools

#### Scenario: SCN-PROBE-005-2 Other args
- **WHEN** `getProbeCache` runs for the same command with other args
- **THEN** it returns nothing

#### Scenario: SCN-PROBE-005-3 An old entry
- **WHEN** an entry is older than 24 hours
- **THEN** `getProbeCache` returns nothing

#### Scenario: SCN-PROBE-005-4 Corrupt state
- **WHEN** the workspace state holds a value that is not an object
- **THEN** `getProbeCache` returns nothing and does not throw

### Requirement: REQ-PROBE-006 Probe targets
`getProbeTargets` SHALL return each enabled server that has a command and no known tool. Each target SHALL carry the server name, command, args, and env.

#### Scenario: SCN-PROBE-006-1 A stub server
- **WHEN** an enabled server has a command and no tool in any source
- **THEN** `getProbeTargets` holds it
