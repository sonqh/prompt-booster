# Spec Delta

## ADDED Requirements

### Requirement: REQ-SKILL-012 Manual A/B record
`docs/eval/ab-skill-0.1.0.csv` SHALL hold 20 data rows with the six columns of scenario 6. The expected tools SHALL be committed before the run. `scripts/check-ab.mjs` SHALL print `pass` when the sum of `boosted_ok` minus the sum of `raw_ok` is 3 or more and the boosted request is worse on 2 rows at most. It SHALL print `fail` for every other well-formed file and exit 1 for a malformed one. The run SHALL not be repeated.

Refs: ADR-004

#### Scenario: SCN-SKILL-012-1 A clear gain
- **WHEN** the record holds 12 rows with `boosted_ok` 1, 8 rows with `raw_ok` 1, and one row where the boosted request is worse
- **THEN** the script prints `pass` and exits 0

#### Scenario: SCN-SKILL-012-2 A small gain
- **WHEN** the record holds a difference of 2
- **THEN** the script prints `fail` and exits 0

#### Scenario: SCN-SKILL-012-3 A gain with three losses
- **WHEN** the difference is 4 and the boosted request is worse on 3 rows
- **THEN** the script prints `fail`

#### Scenario: SCN-SKILL-012-4 A short file
- **WHEN** the record holds 19 data rows
- **THEN** the script exits 1

#### Scenario: SCN-SKILL-012-5 Labels only
- **WHEN** the record holds 20 rows with `id` and `expected_tools` and four empty columns, and `--labels-only` is set
- **THEN** the script exits 0

#### Scenario: SCN-SKILL-012-6 The header
- **WHEN** a reader opens the first line of the record that is not a comment
- **THEN** it is `id,expected_tools,raw_first_tool,boosted_first_tool,raw_ok,boosted_ok`

### Requirement: REQ-SKILL-013 README claim follows the evidence
The first screen of the README SHALL hold the pass text when the record gives `pass` and the fail text when it gives `fail`. Both texts are fixed in the scenarios below. The host list in the text SHALL equal the hosts that passed the spike. The README SHALL link the record. `node scripts/check-ab.mjs --readme README.md` SHALL fail on a difference. A `fail` outcome SHALL not stop the release.

Refs: REQ-SKILL-012, REQ-SKILL-004, REQ-REL-005

#### Scenario: SCN-SKILL-013-1 The pass text
- **WHEN** the record gives `pass`
- **THEN** the README says that the agent `names the tools it will call first` and that `boosted requests reached the correct first tool more often than raw requests`

#### Scenario: SCN-SKILL-013-2 The fail text
- **WHEN** the record gives `fail`
- **THEN** the README says that the agent `lists the tools it plans to use` and that `it did not beat the raw request on first tool choice`

#### Scenario: SCN-SKILL-013-3 A claim with no evidence
- **WHEN** the record gives `fail` and the README holds the pass text
- **THEN** the script exits 1

#### Scenario: SCN-SKILL-013-4 A host that failed the spike
- **WHEN** the spike host list has no `claude-code` and the README names Claude Code
- **THEN** the script exits 1

#### Scenario: SCN-SKILL-013-5 The fixed ending
- **WHEN** a reader opens the first screen with either outcome
- **THEN** it ends with `Instructions only: no scripts, no hooks, no server, no telemetry.`

### Requirement: REQ-SKILL-014 Plugin release
The first release of the plugin SHALL be version 0.1.0. The plugin manifests SHALL hold that version, `CHANGELOG.md` SHALL have a plugin entry for it with the A/B outcome, and the owner SHALL make the git tag `v0.1.0`. The version of the frozen extension SHALL not change.

#### Scenario: SCN-SKILL-014-1 The tag
- **WHEN** the owner made the tag
- **THEN** `git tag --list` holds `v0.1.0`, each plugin manifest holds `0.1.0`, and `package.json` still holds `0.2.4`

### Requirement: REQ-SKILL-015 Feedback and discovery channels
The repository SHALL hold an issue template for feedback on the skill and a template config that links GitHub Discussions. The README SHALL link both. The owner SHALL open one pull request to `github/awesome-copilot` that adds the skill, and `docs/release/awesome-copilot-pr.md` SHALL hold its URL.

Refs: ADR-004

#### Scenario: SCN-SKILL-015-1 A new issue
- **WHEN** a user opens the new issue page
- **THEN** the page offers the feedback template and a link to Discussions

#### Scenario: SCN-SKILL-015-2 The pull request
- **WHEN** a reader opens `docs/release/awesome-copilot-pr.md`
- **THEN** it holds one line `pr:` with a URL of a pull request in `github/awesome-copilot`

### Requirement: REQ-SKILL-005 Signal log
The project SHALL measure use only by GitHub stars, unique cloners, and external feedback items. The skill SHALL send no data. `docs/eval/signals.md` SHALL get one row per week from the day of the tag. On day 90 it SHALL get one decision line. The decision SHALL be `freeze` when the repository has under 15 stars and zero external feedback items.

Refs: ADR-004

#### Scenario: SCN-SKILL-005-1 A weekly row
- **WHEN** a week passed after the tag
- **THEN** the log has a new row with the date, the stars, the cloners, and the feedback count

#### Scenario: SCN-SKILL-005-2 Day 90 with no signal
- **WHEN** day 90 comes with 9 stars and no external feedback
- **THEN** the log holds `decision: freeze`
