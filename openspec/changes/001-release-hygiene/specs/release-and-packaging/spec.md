# Spec Delta

## Purpose
The rules that make the repository safe to package and release: a valid license, a changelog that matches the version, a package with runtime files only, clean production dependencies, a CI gate, and user-facing text that states only real behavior.

## ADDED Requirements

### Requirement: REQ-REL-001 License text
The `LICENSE` file SHALL hold the full MIT License text: the copyright line, the permission grant, the condition that the notice stays in copies, and the warranty disclaimer.

#### Scenario: SCN-REL-001-1 The grant is present
- **WHEN** a reader opens `LICENSE`
- **THEN** the file holds `Permission is hereby granted, free of charge` and `WITHOUT WARRANTY OF ANY KIND`

### Requirement: REQ-REL-002 Changelog matches the version
`CHANGELOG.md` SHALL have one entry for each released version, newest first. The newest release entry SHALL be the `version` of `package.json`. An `Unreleased` entry above it SHALL not count.

#### Scenario: SCN-REL-002-1 Version 0.2.4
- **WHEN** `package.json` has the version `0.2.4`
- **THEN** `CHANGELOG.md` has the headings `## [0.2.4]` and `## [0.2.3]` above `## [0.2.2]`

#### Scenario: SCN-REL-002-2 A version with no entry
- **WHEN** `package.json` has a version that has no CHANGELOG heading
- **THEN** the `changelog` rule of the release check fails

### Requirement: REQ-REL-003 Package content
The VSIX SHALL hold only `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, the icon file, and JavaScript files under `out/`. It SHALL hold no agent file, planning file, spec file, test file, or source map. `npm run package` SHALL work after `npm ci` with no global tool.

#### Scenario: SCN-REL-003-1 The file list
- **WHEN** `vsce ls` runs in the repository
- **THEN** each listed path is on the allow list

#### Scenario: SCN-REL-003-2 A new internal folder
- **WHEN** a pull request adds a folder that `.vscodeignore` does not exclude
- **THEN** the `vsix` rule of the release check fails

### Requirement: REQ-REL-004 CI gate
A workflow at `.github/workflows/ci.yml` SHALL run `npm ci`, compile, lint, the test suite, the release checks, and a package build on each push and each pull request. A failure of one step SHALL fail the workflow. The test step SHALL run on a machine with no display.

#### Scenario: SCN-REL-004-1 A lint error
- **WHEN** a pull request adds a lint error
- **THEN** the workflow fails

#### Scenario: SCN-REL-004-2 No display
- **WHEN** `npm run test:headless` runs on Linux with no `DISPLAY`
- **THEN** the suite runs under `xvfb-run`

### Requirement: REQ-REL-005 User-facing text states real behavior
The README, the manifest, and the permission dialog SHALL say that enhancement runs when the user types `@PromptBooster`. They SHALL not say that prompts are intercepted. The README SHALL not say that `src/core` never imports `vscode` while a core file imports it. The permission dialog SHALL show real line breaks and SHALL promise no feature that the code does not have.

Refs: REQ-CHAT-001, REQ-CHAT-003

#### Scenario: SCN-REL-005-1 The interception claim
- **WHEN** a reader searches the README for `Automatic prompt interception`
- **THEN** the text is not there

#### Scenario: SCN-REL-005-2 The permission dialog
- **WHEN** the permission dialog opens
- **THEN** it names `@PromptBooster`, it holds no `Intercept chat prompts` line, and it shows no literal `\n` text

#### Scenario: SCN-REL-005-3 The participant description
- **WHEN** a reader opens the chat participant entry of the manifest
- **THEN** its description does not start with `Intercepts`

### Requirement: REQ-REL-006 Production dependencies
`dependencies` in `package.json` SHALL list only packages that a file under `src` imports. `npm audit --omit=dev --audit-level=high` SHALL exit 0.

#### Scenario: SCN-REL-006-1 The alpha packages
- **WHEN** a reader searches `package.json` for `@vscode/chat-extension-utils` and `@vscode/prompt-tsx`
- **THEN** neither is there

#### Scenario: SCN-REL-006-2 The audit
- **WHEN** `npm audit --omit=dev --audit-level=high` runs after `npm ci`
- **THEN** it exits 0

### Requirement: REQ-REL-007 Release check script
`scripts/check-release.mjs` SHALL exit 1 and name the rule when one of these is true: a declared command has no handler, no file under `src` reads a declared setting, the version and the CHANGELOG differ, the README holds a forbidden phrase, `vsce ls` lists a file that is not allowed, or the model default differs between code and manifest. It SHALL accept `--list`, `--rule <name>`, and `--all`.

Refs: REQ-REL-002, REQ-REL-003, REQ-REL-005

#### Scenario: SCN-REL-007-1 A command with no handler
- **WHEN** the manifest declares a command that no file under `src` registers and `--rule commands` runs
- **THEN** the script exits 1 and prints the command id

#### Scenario: SCN-REL-007-2 A clean tree
- **WHEN** every rule holds and `--all` runs
- **THEN** the script exits 0

#### Scenario: SCN-REL-007-3 The rule list
- **WHEN** `--list` runs
- **THEN** the output holds `commands`, `settings`, `changelog`, `readme`, `vsix`, and `model-default`
