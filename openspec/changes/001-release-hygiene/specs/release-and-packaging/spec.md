# Spec Delta

## Purpose
The rules that make the repository safe to package and release: a valid license, a changelog that matches the version, a package with no internal files, a CI gate, and a README that states only real behavior.

## ADDED Requirements

### Requirement: REQ-REL-001 License text
The `LICENSE` file SHALL hold the full MIT License text: the copyright line, the permission grant, the condition that the notice stays in copies, and the warranty disclaimer.

#### Scenario: SCN-REL-001-1 The grant is present
- **WHEN** a reader opens `LICENSE`
- **THEN** the file holds `Permission is hereby granted, free of charge` and `WITHOUT WARRANTY OF ANY KIND`

### Requirement: REQ-REL-002 Changelog matches the version
`CHANGELOG.md` SHALL have one entry for each released version, newest first. The top entry SHALL be the `version` of `package.json`.

#### Scenario: SCN-REL-002-1 Version 0.2.4
- **WHEN** `package.json` has the version `0.2.4`
- **THEN** `CHANGELOG.md` has the headings `## [0.2.4]` and `## [0.2.3]` above `## [0.2.2]`

### Requirement: REQ-REL-003 Package content
The VSIX SHALL not hold agent files, planning files, or spec files: `AGENTS.md`, `CLAUDE.md`, `implementation_plan.md`, `walkthrough.md`, `spec-ctx.toml`, and the folders `.claude`, `.opencode`, `.agents`, `.ctx`, `openspec`, `decisions`, `docs`, `.github`. `npm run package` SHALL work after `npm ci` with no global tool.

#### Scenario: SCN-REL-003-1 The file list
- **WHEN** `vsce ls` runs in the repository
- **THEN** no listed path starts with one of the excluded names

### Requirement: REQ-REL-004 CI gate
A workflow at `.github/workflows/ci.yml` SHALL run `npm ci`, `npm run compile`, `npm run lint`, and the test suite under `xvfb-run` on each push and each pull request. A failure of one step SHALL fail the workflow.

#### Scenario: SCN-REL-004-1 A lint error
- **WHEN** a pull request adds a lint error
- **THEN** the workflow fails

### Requirement: REQ-REL-005 README states real behavior
The README SHALL say that enhancement runs when the user addresses `@PromptBooster`. It SHALL not say that prompts are intercepted automatically. It SHALL list only commands that the manifest declares. It SHALL not say that `src/core` never imports `vscode` while a core file imports it.

Refs: REQ-CHAT-001

#### Scenario: SCN-REL-005-1 The interception claim
- **WHEN** a reader searches the README for `Automatic prompt interception`
- **THEN** the text is not there

#### Scenario: SCN-REL-005-2 The command list
- **WHEN** a reader compares the README command list with `contributes.commands`
- **THEN** each README command is in the manifest
