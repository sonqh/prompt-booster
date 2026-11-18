# Spec Delta

## Purpose
The `/prompt-booster:boost` skill and its agent plugin for GitHub Copilot and Claude Code: an instruction-only skill that restates a rough request and names the first tools, the host facts that it rests on, and the evidence for its claim.

## ADDED Requirements

### Requirement: REQ-SKILL-004 Dated host facts
Each spike check SHALL have one result file under `docs/spike/`. The file SHALL hold a `date:` line, one `version:` line for each host that it tested, the steps, and one line `result: <host>: <pass|fail|n/a>` for each host. `docs/spike/README.md` SHALL hold one `hosts:` line with the hosts that passed the install, invocation, and explicit-only checks.

#### Scenario: SCN-SKILL-004-1 A result file
- **WHEN** a reader opens `docs/spike/01-install.md`
- **THEN** it holds a date, the host versions, and a `result:` line for `vscode-copilot`, `copilot-cli`, and `claude-code`

#### Scenario: SCN-SKILL-004-2 The host list
- **WHEN** a later change needs the supported hosts
- **THEN** it reads the `hosts:` line of `docs/spike/README.md`

### Requirement: REQ-SKILL-006 Install and invocation facts
The spike SHALL record, for Copilot in VS Code, the Copilot CLI, and Claude Code: if one folder with a root `plugin.json` and a `.claude-plugin/plugin.json` installs from a local folder, from a Git URL, and from a subfolder; the validator command; the exact invocation name of a plugin skill; if the argument reaches the skill; and if `disable-model-invocation: true` stops a load without the slash command. It SHALL record the same for the Copilot app, or `n/a`.

#### Scenario: SCN-SKILL-006-1 Install from a Git URL
- **WHEN** the owner installs the fixture plugin from a Git URL on each host
- **THEN** `01-install.md` holds one result per host and the install form that worked

#### Scenario: SCN-SKILL-006-2 The invocation name
- **WHEN** the owner runs the fixture skill with an argument on each host
- **THEN** `02-invocation.md` holds the exact name that worked and says if the argument arrived

#### Scenario: SCN-SKILL-006-3 Explicit only
- **WHEN** the owner asks a question that fits the fixture skill and does not type the slash command
- **THEN** `03-explicit-only.md` says for each host if the skill stayed unloaded

### Requirement: REQ-SKILL-007 Tool visibility and headless facts
The spike SHALL record if the model inside the skill can list the live tools of the host, with the count that it listed and the real count. It SHALL record if the Copilot CLI and Claude Code can run a prompt headless and print the first tool call in a form that a script can read.

#### Scenario: SCN-SKILL-007-1 The tool list
- **WHEN** the fixture skill asks the model to list every tool that it can call, with one MCP server configured
- **THEN** `04-tool-visibility.md` holds both counts per host and names a deferred tool search when one exists

#### Scenario: SCN-SKILL-007-2 A headless run
- **WHEN** the owner runs one prompt headless on each CLI
- **THEN** `06-headless.md` says per host if the output names the first tool call

### Requirement: REQ-SKILL-008 Harness facts
The spike SHALL record the VS Code version that made the Copilot harness the default, with its source, and the Session Target of a clean profile. It SHALL record if `Boost This Prompt` and `Process Prompt File` of the frozen extension work on the Copilot harness.

Refs: REQ-REL-005, ADR-004

#### Scenario: SCN-SKILL-008-1 The default harness
- **WHEN** a reader opens `05-default-harness.md`
- **THEN** it names a VS Code version and the source of that fact

#### Scenario: SCN-SKILL-008-2 The legacy commands
- **WHEN** the owner runs the two editor commands on the Copilot harness
- **THEN** `08-legacy-extension.md` holds pass or fail for each command
