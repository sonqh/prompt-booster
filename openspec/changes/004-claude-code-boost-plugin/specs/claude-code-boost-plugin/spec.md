# Spec Delta

## Purpose
A Claude Code plugin that rewrites a rough prompt on `/boost` with references to the tools that the user has, and that records which tools the agent then calls. It reuses the PromptBooster core code in plain Node.

## ADDED Requirements

### Requirement: REQ-PLUG-001 Verified host facts
The plugin package SHALL hold a facts record `FACTS.md`. The record SHALL name the Claude Code CLI version and the date of the check. It SHALL list each hook event, hook field, and skill feature that the plugin uses, with the result of the check and each difference from section 2 of the design.

#### Scenario: SCN-PLUG-001-1 A milestone starts
- **WHEN** work on a milestone starts
- **THEN** `FACTS.md` names a CLI version and a date for that milestone, and each used surface has a result

### Requirement: REQ-PLUG-002 Plugin skeleton
The package at `packages/claude-code-plugin/` SHALL hold `.claude-plugin/plugin.json`, `hooks/hooks.json`, and the skills folder. `claude plugin validate` SHALL pass on it. Claude Code SHALL load it with `--plugin-dir`.

#### Scenario: SCN-PLUG-002-1 Validation
- **WHEN** `claude plugin validate packages/claude-code-plugin` runs
- **THEN** it exits 0

### Requirement: REQ-PLUG-003 Boost skill
The `/boost` skill SHALL pass the text after the command to the `claude-boost` CLI on stdin, through a heredoc with a quoted delimiter. The shell SHALL not expand quotes, `$`, or backticks in the prompt. The skill SHALL tell Claude that the CLI output is the prompt to act on.

#### Scenario: SCN-PLUG-003-1 A prompt with shell characters
- **WHEN** the user runs `/boost` with a prompt that holds double quotes, `$HOME`, and a backtick
- **THEN** the CLI receives that text unchanged on stdin

### Requirement: REQ-PLUG-004 Tool inventory
The CLI SHALL read MCP servers from four scopes: Local and User in `~/.claude.json`, Project in `.mcp.json`, and Plugin in a plugin `.mcp.json`. It SHALL list the skills and subagents folders. It SHALL build an inventory fingerprint from these inputs. It SHALL never store or log an `env` value. A missing or malformed file SHALL give an empty scope and no error.

Refs: REQ-PROBE-004

#### Scenario: SCN-PLUG-004-1 Four scopes
- **WHEN** each scope declares one server
- **THEN** the inventory holds four servers, each with its scope

#### Scenario: SCN-PLUG-004-2 A secret in the config
- **WHEN** `~/.claude.json` holds a server with an `env` secret
- **THEN** no file under the state folder and no output line holds the secret

#### Scenario: SCN-PLUG-004-3 A changed file
- **WHEN** `.mcp.json` changes
- **THEN** the inventory fingerprint changes

### Requirement: REQ-PLUG-005 Rewrite
The CLI SHALL score the inventory with `classifyTools`, call the optimizer through headless `claude -p`, and print the rewritten prompt. An MCP tool reference in the rewrite SHALL use the literal name `mcp__<server>__<tool>`. With no MCP server, the output SHALL equal the output of a boost with no catalog. An optimizer failure SHALL print the original prompt and exit 0.

Refs: REQ-INJ-001, REQ-INJ-002, REQ-INJ-005

#### Scenario: SCN-PLUG-005-1 A fitting server
- **WHEN** one configured server has a tool that fits the prompt
- **THEN** the optimizer input names that tool as `mcp__<server>__<tool>`

#### Scenario: SCN-PLUG-005-2 No server
- **WHEN** no MCP server is configured
- **THEN** the optimizer input equals the input of a boost with no catalog

#### Scenario: SCN-PLUG-005-3 The optimizer fails
- **WHEN** the `claude -p` call fails
- **THEN** the CLI prints the original prompt and exits 0

### Requirement: REQ-PLUG-006 Tool-use telemetry
The tool-use hook SHALL append one JSON line per tool call to `telemetry/<session>.jsonl`. A line SHALL hold only `tool_name`, `tool_use_id`, `duration_ms`, and `timestamp`. The hook SHALL never store `tool_input` or `tool_response`. The hook SHALL read no file and SHALL exit 0 on a write error.

#### Scenario: SCN-PLUG-006-1 An MCP call
- **WHEN** the hook receives a `PostToolUse` event for `mcp__db__query` with an input that holds a password
- **THEN** the session file gains one line with the four fields, and the password is not in the file

### Requirement: REQ-PLUG-007 Session correlation
The CLI SHALL store the SHA-256 of each rewritten prompt in a pending record. The prompt-submit hook SHALL link a submitted prompt to that record when the hashes are equal, and store the session id. A prompt with no equal hash SHALL leave its telemetry unlinked, give no label, and raise no error.

#### Scenario: SCN-PLUG-007-1 The rewrite is sent as it is
- **WHEN** the user submits the rewrite unchanged
- **THEN** the pending record holds the session id

#### Scenario: SCN-PLUG-007-2 The rewrite is edited
- **WHEN** the user edits the rewrite before the submit
- **THEN** no record gets the session id and the hook exits 0

### Requirement: REQ-PLUG-008 State storage
The plugin SHALL keep all state under `~/.claude/promptbooster/`, or under the official plugin data folder when `FACTS.md` records one. It SHALL create each file with mode `0600`. It SHALL write no state inside a repository.

Refs: ADR-002

#### Scenario: SCN-PLUG-008-1 A new cache file
- **WHEN** the plugin creates `cache.json`
- **THEN** the file mode is `0600`

### Requirement: REQ-PLUG-009 Response cache
The plugin SHALL cache the optimizer output in a file. The key SHALL be the SHA-256 of `pb-cc-cache-v1`, the normalized raw prompt, the inventory fingerprint, `OPTIMIZER_PROMPT_VERSION`, and the few-shot stamp. The cache SHALL use the TTL and the least-recently-used cap of the core cache. A corrupt file SHALL be a miss. The same prompt inside the TTL SHALL cause no optimizer call.

Refs: REQ-FBK-007, REQ-FBK-008

#### Scenario: SCN-PLUG-009-1 A repeated prompt
- **WHEN** the same prompt is boosted twice inside the TTL with the same inventory
- **THEN** the optimizer runs one time and both outputs are equal

#### Scenario: SCN-PLUG-009-2 A corrupt file
- **WHEN** `cache.json` holds text that is not JSON
- **THEN** the boost runs the optimizer and does not fail

### Requirement: REQ-PLUG-010 Wider inventory and optimizer override
From M2, the scorer SHALL also score skills and subagents by their frontmatter descriptions. The optimizer SHALL use an Anthropic API key in place of `claude -p` when the plugin settings name one.

#### Scenario: SCN-PLUG-010-1 A fitting subagent
- **WHEN** a subagent description fits the prompt
- **THEN** the optimizer input names that subagent

#### Scenario: SCN-PLUG-010-2 An API key is set
- **WHEN** the settings hold an API key
- **THEN** the CLI starts no `claude -p` process

### Requirement: REQ-PLUG-011 Boost report
The `/boost-report` skill SHALL print the count of boosts, the share of injected references that a session then called, the count of called tools that were not injected, and the cache hit rate. It SHALL read only the local state files. A reference that was not called SHALL get no label.

#### Scenario: SCN-PLUG-011-1 One of two references is used
- **WHEN** a boost injected two references and the linked session called one
- **THEN** the report shows observed-use precision of 50%

### Requirement: REQ-PLUG-012 Learning and ambient mode are opt-in
A reference that a linked session called SHALL get the label `used-strong`. Few-shot examples from such boosts and ambient hints through `additionalContext` SHALL be off by default. With both off, the output SHALL equal the M2 output. An ambient block SHALL stay under its character budget. The plugin SHALL not read or write the learning state of the VS Code extension.

Refs: REQ-FBK-009, ADR-002

#### Scenario: SCN-PLUG-012-1 The defaults
- **WHEN** the settings file is absent
- **THEN** the prompt-submit hook adds no context and the optimizer input has no few-shot block

#### Scenario: SCN-PLUG-012-2 Few-shot is on
- **WHEN** few-shot is on and one boost has a `used-strong` reference
- **THEN** the next optimizer input holds a few-shot block and the cache key changes

### Requirement: REQ-PLUG-013 Packaging
The plugin SHALL install from a git URL and with `--plugin-dir` on a clean machine. Its README SHALL list each file that the plugin reads and each file that it writes. The hook bundles SHALL need no `npm install` on the user machine.

#### Scenario: SCN-PLUG-013-1 A clean machine
- **WHEN** a user clones the repository and starts `claude --plugin-dir packages/claude-code-plugin`
- **THEN** `/boost` works with no other install step
