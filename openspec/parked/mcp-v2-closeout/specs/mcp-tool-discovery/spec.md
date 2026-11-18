# Spec Delta

## ADDED Requirements

### Requirement: REQ-DISC-012 URL servers
A server entry that has a `url` and no `command` SHALL be registered by name only. Its `headers` and its `url` SHALL be dropped at parse time. It SHALL have no catalog entry from the config and SHALL not be a probe target. The extension SHALL open no network connection to an MCP server.

Refs: REQ-PROBE-007

#### Scenario: SCN-DISC-012-1 A url server in a config file
- **WHEN** `.vscode/mcp.json` declares `remote` with a `url` and `headers`
- **THEN** `getServerNames` holds `remote`, the catalog holds no tool for it, and `getProbeTargets` does not hold it

#### Scenario: SCN-DISC-012-2 No network code
- **WHEN** a search for an import of `http`, `https`, or `net`, or a call of `fetch`, runs on `src/core` and `src/infrastructure`
- **THEN** it finds nothing

### Requirement: REQ-DISC-013 Untrusted workspace
In a workspace that the user did not trust, the registry SHALL read no MCP config file inside the workspace folder, and it SHALL use only the user-level value of `mcp.servers`. The catalog SHALL refresh when the user grants trust. The manifest SHALL declare `capabilities.untrustedWorkspaces.supported` as `limited`.

Refs: REQ-DISC-001, REQ-PROBE-001

#### Scenario: SCN-DISC-013-1 A workspace file in an untrusted workspace
- **WHEN** the workspace is not trusted and `.vscode/mcp.json` declares a server with inline tools
- **THEN** the catalog holds no tool of that server

#### Scenario: SCN-DISC-013-2 A home file in an untrusted workspace
- **WHEN** the workspace is not trusted and `~/.claude.json` declares a server
- **THEN** discovery reads that server as before

#### Scenario: SCN-DISC-013-3 Trust is granted
- **WHEN** the user grants trust and the config watcher fires
- **THEN** the next refresh reads the workspace files
