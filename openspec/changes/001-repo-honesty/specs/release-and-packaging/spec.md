# Spec Delta

## Purpose
The rules that keep the repository honest: a valid license, a changelog that matches the version, text that states only real behavior and the real status of each part, a manifest that is safe for a frozen extension, and a CI gate.

## ADDED Requirements

### Requirement: REQ-REL-001 License text
The `LICENSE` file SHALL hold the full MIT License text: the copyright line, the permission grant, the condition that the notice stays in copies, and the warranty disclaimer.

#### Scenario: SCN-REL-001-1 The grant is present
- **WHEN** a reader opens `LICENSE`
- **THEN** the file holds `Permission is hereby granted, free of charge` and `WITHOUT WARRANTY OF ANY KIND`

### Requirement: REQ-REL-002 Changelog matches the version
`CHANGELOG.md` SHALL have one entry for each version of the extension, newest first. The newest release entry SHALL be the `version` of `package.json`. An `Unreleased` entry above it SHALL not count. The `Unreleased` entry SHALL state that the extension is frozen and why.

#### Scenario: SCN-REL-002-1 Version 0.2.4
- **WHEN** `package.json` has the version `0.2.4`
- **THEN** `CHANGELOG.md` has the headings `## [0.2.4]` and `## [0.2.3]` above `## [0.2.2]`

#### Scenario: SCN-REL-002-2 The freeze note
- **WHEN** a reader opens the `Unreleased` entry
- **THEN** it names the freeze of the extension and the deprecation of chat participants

### Requirement: REQ-REL-004 CI gate
A workflow at `.github/workflows/ci.yml` SHALL run `npm ci`, compile, lint, `specctx check --strict`, and `openspec validate --all --strict` on each push and each pull request. A failure of one of these steps SHALL fail the workflow. The Electron test suite SHALL run in a step that does not block.

#### Scenario: SCN-REL-004-1 A lint error
- **WHEN** a pull request adds a lint error
- **THEN** the workflow fails

#### Scenario: SCN-REL-004-2 A failing Electron test
- **WHEN** a test of the frozen extension fails
- **THEN** the step shows the failure and the workflow still passes

### Requirement: REQ-REL-005 User-facing text states real behavior
The first 30 lines of the README SHALL say that the product is the agent plugin, that the VS Code extension is legacy, that it runs only on the Local harness until February 2027, and SHALL link the VS Code page on chat participants. They SHALL not name `@PromptBooster`. The README SHALL not say that prompts are intercepted or that `src/core` never imports `vscode`. Its legacy section SHALL list the known open issues of the extension.

Refs: REQ-CHAT-001, ADR-004

#### Scenario: SCN-REL-005-1 The first screen
- **WHEN** a visitor reads the first 30 lines of the README
- **THEN** they hold `Legacy`, `February 2027`, and `https://code.visualstudio.com/api/extension-guides/ai/chat`, and they do not hold `@PromptBooster`

#### Scenario: SCN-REL-005-2 The interception claim
- **WHEN** a reader searches the README for `Automatic prompt interception` and for `never imports`
- **THEN** neither text is there

#### Scenario: SCN-REL-005-3 The known issues
- **WHEN** a reader opens the legacy section
- **THEN** it says that the catalog fingerprint in workspace state can hold `env` values of MCP settings, that the probe has no workspace-trust check in code, and that the probe is off by default

### Requirement: REQ-REL-016 Manifest of the frozen extension
The manifest SHALL set `capabilities.untrustedWorkspaces.supported` to `false`, so the extension does not activate in an untrusted workspace. `promptBooster.mcp.probeServers` SHALL have the scope `machine`, and its description SHALL say that the probe runs only from the refresh command. The manifest `description` SHALL start with `Legacy (Local harness only)`. The `version` SHALL not change.

Refs: REQ-PROBE-001, ADR-004

#### Scenario: SCN-REL-016-1 An untrusted folder
- **WHEN** the user opens a cloned repository and does not trust it
- **THEN** VS Code does not activate the extension

#### Scenario: SCN-REL-016-2 A workspace settings file
- **WHEN** `.vscode/settings.json` of a repository sets `promptBooster.mcp.probeServers` to true
- **THEN** the setting keeps its user or default value

#### Scenario: SCN-REL-016-3 The listing text
- **WHEN** a reader opens the extension details
- **THEN** the description starts with `Legacy (Local harness only)`

### Requirement: REQ-REL-017 Agent guide states real status
`AGENTS.md` SHALL say that the extension is frozen and that the plugin is the product. It SHALL not say that the Meta-MCP design drives current work, that the extension intercepts prompts, or that core code is free of `vscode`. It SHALL keep the rule against new `vscode` imports in `src/core` and SHALL say that seven files break it.

Refs: ADR-004

#### Scenario: SCN-REL-017-1 The false lines
- **WHEN** a reader searches `AGENTS.md` for `driving current work` and for `intercepts`
- **THEN** neither text is there

#### Scenario: SCN-REL-017-2 The status
- **WHEN** an agent reads the project overview of `AGENTS.md`
- **THEN** it learns that the extension is frozen and that new work goes to the plugin
