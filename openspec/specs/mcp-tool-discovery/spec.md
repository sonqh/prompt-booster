# mcp-tool-discovery Specification

## Purpose
How PromptBooster finds the MCP servers and tools of the user and keeps a catalog of them. It covers the config sources, the priority of tool sources, the tags on each tool, the cache, and the refresh command. Discovery reads config and never starts a server.

## Requirements

### Requirement: REQ-DISC-001 Config sources
`MCPToolRegistry.discover` SHALL read server maps from `.vscode/mcp.json`, the VS Code `mcp.servers` setting, `~/.claude/claude_desktop_config.json`, `~/.claude.json`, `.claude/settings.json`, `.github/copilot/mcp.json`, `.cursor/mcp.json`, and `.cline/mcp.json`. It SHALL accept the key `servers` or `mcpServers`. A missing file SHALL be skipped with no warning. A file with malformed JSON SHALL be skipped with one warning. No source SHALL give an empty catalog and no error.

#### Scenario: SCN-DISC-001-1 The workspace file has inline tools
- **WHEN** `.vscode/mcp.json` declares a server with a `tools` list
- **THEN** the catalog holds each tool with the qualified name `<server>.<tool>`

#### Scenario: SCN-DISC-001-2 Only another file exists
- **WHEN** `.vscode/mcp.json` is absent and `.cline/mcp.json` declares a server with tools
- **THEN** the catalog holds the tools of the Cline file

#### Scenario: SCN-DISC-001-3 Malformed JSON
- **WHEN** a config file holds text that is not JSON
- **THEN** the file adds no server and the logger holds a warning

#### Scenario: SCN-DISC-001-4 No source
- **WHEN** no config file and no setting exists
- **THEN** the catalog is empty and `discover` does not throw

### Requirement: REQ-DISC-002 Tool source priority
For each server the tool list SHALL come from the first source that has one, in this order: the VS Code runtime tool list, the probe cache, the manual index, an inline `tools` list in a config file. A server with no tool list SHALL be a stub that has a name and no catalog entry. The manual index SHALL also add servers that no config file declares.

Refs: ADR-002

#### Scenario: SCN-DISC-002-1 Runtime beats config
- **WHEN** the runtime lists a tool for a server and a config file declares inline tools for the same server
- **THEN** the catalog holds the runtime tool with origin `runtime-api`

#### Scenario: SCN-DISC-002-2 The manual index beats inline tools
- **WHEN** a config file declares inline tools for a server and the manual index holds entries for it
- **THEN** the catalog holds only the manual index entries for that server

#### Scenario: SCN-DISC-002-3 The probe cache fills a stub
- **WHEN** a server has a command, no inline tools, and a fresh probe cache entry
- **THEN** the catalog holds the cached tools with source `probe-cache`, also when the manual index has entries for the server

#### Scenario: SCN-DISC-002-4 A stub stays empty
- **WHEN** a server has no tool list in any source
- **THEN** `getServerNames` holds the server and the catalog holds no tool for it

### Requirement: REQ-DISC-003 Tool tags
Each catalog entry SHALL carry `source`, `sources`, `visibility`, and `origin`. Visibility SHALL be `foreign` for tools from the sources `claude-desktop`, `claude-code-global`, `claude-code-workspace`, `cursor`, and `cline`. It SHALL be `injectable` for every other source. `getInjectableCatalog` SHALL return only enabled tools with visibility `injectable`.

Refs: ADR-002

#### Scenario: SCN-DISC-003-1 A workspace tool
- **WHEN** a tool comes from an inline list in `.vscode/mcp.json`
- **THEN** it has source `vscode-workspace`, visibility `injectable`, and origin `inline-schema`

#### Scenario: SCN-DISC-003-2 A foreign tool
- **WHEN** a tool comes from the Claude Desktop config
- **THEN** `getToolCatalog` holds it and `getInjectableCatalog` does not

### Requirement: REQ-DISC-004 Duplicate servers
When two sources declare a server of the same name, the first source in read order SHALL supply the tools and the visibility. Each later source SHALL be added to `sources`. The registry SHALL log a warning when the two entries have different `command` and `args`. It SHALL log no warning when they are the same.

#### Scenario: SCN-DISC-004-1 Different commands
- **WHEN** `.vscode/mcp.json` and `.cursor/mcp.json` declare `db` with different commands
- **THEN** the catalog holds the workspace version and the logger holds a warning that names `db`

### Requirement: REQ-DISC-005 Enablement
A server SHALL be disabled when its config has `disabled: true`, when it has no `command`, or when the VS Code `mcp.servers` setting marks it as disabled. `getToolCatalog` SHALL return no tool of a disabled server.

#### Scenario: SCN-DISC-005-1 A disabled server
- **WHEN** a server with inline tools has `disabled: true`
- **THEN** `getToolCatalog` holds none of its tools

#### Scenario: SCN-DISC-005-2 An empty command
- **WHEN** a server has the command `""`
- **THEN** the catalog holds none of its tools

### Requirement: REQ-DISC-006 Config size cap
The registry SHALL skip a config file larger than 5 MB. It SHALL not read or parse the file, and it SHALL log one warning with the size.

#### Scenario: SCN-DISC-006-1 A large file
- **WHEN** `~/.claude.json` reports a size above 5 MB
- **THEN** the catalog holds no server of that file and the logger holds a warning that names the file

### Requirement: REQ-DISC-007 Cached catalog
`ensureCatalog` SHALL wait for discovery on its first call only. On later calls it SHALL return the cached catalog at once. It SHALL start a background refresh when the fingerprint changed or when `mcp.cacheTtlMinutes` passed. A config watcher event SHALL change the fingerprint. A discovery that fails SHALL keep the cached catalog and log the error. A refresh SHALL replace the served catalog only when it completes.

#### Scenario: SCN-DISC-007-1 Nothing changed
- **WHEN** `ensureCatalog` runs twice with no file change inside the TTL
- **THEN** discovery runs one time

#### Scenario: SCN-DISC-007-2 A file changed
- **WHEN** a config file changes after the first call
- **THEN** the next call returns the old catalog and the call after it returns the new catalog

#### Scenario: SCN-DISC-007-3 A watcher event
- **WHEN** the config watcher fires and no file time or size changed
- **THEN** the next `ensureCatalog` starts a refresh

#### Scenario: SCN-DISC-007-4 The TTL passed
- **WHEN** the TTL passed and the fingerprint is the same
- **THEN** the next `ensureCatalog` starts a refresh

### Requirement: REQ-DISC-008 Catalog fingerprint
`getCatalogFingerprint` SHALL return a string built at the last refresh from the path, modification time, and size of each config file, the watcher version, the VS Code server settings, the manual index file, the probe cache stamp, and the runtime availability. It SHALL return the empty string before the first refresh.

#### Scenario: SCN-DISC-008-1 A config file changes
- **WHEN** a config file changes and the catalog refreshes
- **THEN** `getCatalogFingerprint` returns a different string

#### Scenario: SCN-DISC-008-2 The manual index changes
- **WHEN** the manual index file changes and the catalog refreshes
- **THEN** `getCatalogFingerprint` returns a different string

### Requirement: REQ-DISC-009 Runtime tools
The registry SHALL read runtime tools through `IMcpRuntimeToolsProvider`. The VS Code adapter SHALL return only `vscode.lm.tools` entries whose name starts with `mcp_`. It SHALL split the name at the first underscore after the prefix into server and tool. A tool whose name cannot be split SHALL get no catalog entry. A provider that is not available or that throws SHALL add nothing and raise no error.

#### Scenario: SCN-DISC-009-1 Runtime tools with no config
- **WHEN** the runtime lists `mcp_postgres-mcp_query_db` and no config file exists
- **THEN** the catalog holds `postgres-mcp.query_db` with visibility `injectable`

#### Scenario: SCN-DISC-009-2 The runtime is not available
- **WHEN** `isAvailable` returns false
- **THEN** discovery completes from the other sources

### Requirement: REQ-DISC-010 Manual index file
`McpToolIndexStore` SHALL read and write `.vscode/promptbooster-mcp-tools.json` with the shape `{ "tools": [{ server, name, description?, inputSummary? }] }`. An absent file SHALL give an empty list with no warning. Malformed JSON SHALL give an empty list with one warning. An entry with no `server` or no `name` SHALL be dropped. A write error SHALL be logged and not thrown.

#### Scenario: SCN-DISC-010-1 A round trip
- **WHEN** `saveManualIndex` writes two entries and `loadManualIndex` runs
- **THEN** it returns the same two entries

#### Scenario: SCN-DISC-010-2 A wrong entry
- **WHEN** the file holds one entry with no `name` and one valid entry
- **THEN** `loadManualIndex` returns only the valid entry

### Requirement: REQ-DISC-011 Refresh command
`promptBooster.refreshMcpIndex` SHALL run discovery, collect the runtime tools, and add probe results when `mcp.probeServers` is on. It SHALL keep each manual index entry that the new results do not cover. It SHALL write the entries sorted by `<server>.<name>` to the manual index, run discovery again, and show the tool count. It SHALL show an error message on failure.

Refs: REQ-PROBE-001, REQ-DISC-010

#### Scenario: SCN-DISC-011-1 A user entry survives
- **WHEN** the manual index holds `docs.search` and the refresh finds no tool with that name
- **THEN** the written index still holds `docs.search`
