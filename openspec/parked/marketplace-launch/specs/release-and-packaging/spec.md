# Spec Delta

## ADDED Requirements

### Requirement: REQ-REL-008 Publisher
The `publisher` of the manifest SHALL be an id that the owner registered on the VS Code Marketplace and as a namespace on Open VSX. `docs/release/publisher.md` SHALL record the id and the date of the check on each store.

#### Scenario: SCN-REL-008-1 The record matches the manifest
- **WHEN** a reader compares `publisher` in `package.json` with the line `publisher:` in `docs/release/publisher.md`
- **THEN** both hold the same id

### Requirement: REQ-REL-009 Icon
The extension icon SHALL be a PNG file of at least 128 by 128 pixels. The repository SHALL hold no `icon.jpg`, and no file under `src` SHALL name it.

#### Scenario: SCN-REL-009-1 The icon file
- **WHEN** a reader opens `icon.png`
- **THEN** it is a PNG with a width and a height of 128 pixels or more

### Requirement: REQ-REL-010 Manual A/B record
The repository SHALL hold `docs/eval/ab-manual-0.3.0.csv` with the columns `id`, `expected_tools`, `raw_first_tool`, `boosted_first_tool`, `raw_ok`, and `boosted_ok`, and 20 data rows. `scripts/check-ab.mjs` SHALL print `pass` when the sum of `boosted_ok` minus the sum of `raw_ok` is 3 or more and `boosted_ok` is below `raw_ok` on 2 rows at most. It SHALL print `fail` for every other well-formed file. It SHALL exit 1 for a malformed file. The run SHALL not be repeated.

Refs: ADR-003

#### Scenario: SCN-REL-010-1 A clear gain
- **WHEN** the record holds 12 rows with `boosted_ok` 1, 8 rows with `raw_ok` 1, and one row where the boosted prompt is worse
- **THEN** the script prints `pass` and exits 0

#### Scenario: SCN-REL-010-2 A small gain
- **WHEN** the record holds a difference of 2
- **THEN** the script prints `fail` and exits 0

#### Scenario: SCN-REL-010-3 A gain with three losses
- **WHEN** the difference is 4 and the boosted prompt is worse on 3 rows
- **THEN** the script prints `fail`

#### Scenario: SCN-REL-010-4 A short file
- **WHEN** the record holds 19 data rows
- **THEN** the script exits 1

### Requirement: REQ-REL-011 Listing text follows the evidence
The manifest `displayName` and `description` and the README tagline SHALL hold the pass text when the A/B record gives `pass`, and the fail text when it gives `fail`. The two texts are fixed in the scenarios below. The release rule `tagline` SHALL fail on a difference and on a missing record.

Refs: REQ-REL-010, REQ-REL-007

#### Scenario: SCN-REL-011-3 The pass text
- **WHEN** the record gives `pass`
- **THEN** the name is `PromptBooster: Tool-Aware Prompts for Copilot` and the description is `Type @PromptBooster to rewrite a rough prompt with workspace context and the right MCP tools.`

#### Scenario: SCN-REL-011-4 The fail text
- **WHEN** the record gives `fail`
- **THEN** the name is `PromptBooster: Structured Prompts for Copilot` and the description is `Type @PromptBooster to turn a rough prompt into a structured one that uses your workspace context.`

#### Scenario: SCN-REL-011-1 The outcome is fail
- **WHEN** the record gives `fail` and the manifest description names MCP tools
- **THEN** `node scripts/check-release.mjs --rule tagline` exits 1

#### Scenario: SCN-REL-011-2 The outcome is pass
- **WHEN** the record gives `pass` and the manifest and the README hold the pass text
- **THEN** the rule exits 0

### Requirement: REQ-REL-012 Listing media
The README SHALL show one demo GIF of 30 seconds or less and three screenshots from `media/`. The manifest SHALL have `keywords`, `categories`, `bugs`, and `homepage`. The media files SHALL not be in the VSIX.

#### Scenario: SCN-REL-012-1 The media files
- **WHEN** a reader lists `media/`
- **THEN** it holds `demo.gif` and three files `screenshot-*.png`, and the README links each of them

### Requirement: REQ-REL-013 Community channels
The repository SHALL hold issue templates for a bug and for feedback, and a template config that links GitHub Discussions. The README SHALL link Discussions.

#### Scenario: SCN-REL-013-1 A new issue
- **WHEN** a user opens the new issue page
- **THEN** the page offers the bug template, the feedback template, and a link to Discussions

### Requirement: REQ-REL-014 Clean-profile smoke
`scripts/smoke-vsix.mjs` SHALL install the packaged VSIX in a VS Code profile with no other extension and no user settings. It SHALL fail when the extension does not activate or when a command of the manifest is not registered. Its result SHALL be recorded in `docs/release/smoke-0.3.0.md`.

Refs: REQ-CFG-007

#### Scenario: SCN-REL-014-1 A good package
- **WHEN** the smoke script runs on the VSIX of a clean build
- **THEN** it exits 0 and the record lists each command as registered

#### Scenario: SCN-REL-014-2 A missing file in the package
- **WHEN** the VSIX lacks a compiled file that activation needs
- **THEN** the smoke script exits 1

### Requirement: REQ-REL-015 Publish to both stores
A workflow at `.github/workflows/release.yml` SHALL run on a tag `v*`. It SHALL run the full release check and the smoke script, and then publish one VSIX file to the VS Code Marketplace and to Open VSX. The tag SHALL equal the `version` of `package.json`. The first store release SHALL be version 0.3.0, and the owner SHALL make the tag.

Refs: REQ-REL-002, ADR-003

#### Scenario: SCN-REL-015-1 A tag
- **WHEN** the owner pushes the tag `v0.3.0` and the checks pass
- **THEN** both stores receive the same VSIX file

#### Scenario: SCN-REL-015-2 A failed check
- **WHEN** the release check fails in the tagged run
- **THEN** nothing is published
