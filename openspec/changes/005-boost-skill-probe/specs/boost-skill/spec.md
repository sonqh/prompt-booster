# Spec Delta

## Purpose
An instruction-only `/boost` skill for Claude Code that rewrites a rough prompt with the PromptBooster rubric, and the way its use is measured. It is a probe that decides if the full plugin port is worth the work.

## ADDED Requirements

### Requirement: REQ-SKILL-001 Instruction-only skill
The skill SHALL be one hand-written file `plugins/boost/skills/boost/SKILL.md`. The plugin folder SHALL hold only Markdown and JSON files. The skill SHALL hold no shell substitution. It SHALL have no script, no hook, no MCP server, and no generator. It SHALL read no config file.

#### Scenario: SCN-SKILL-001-1 The folder content
- **WHEN** a reader lists every file under `plugins/boost`
- **THEN** each file ends in `.md` or `.json`

#### Scenario: SCN-SKILL-001-2 No shell substitution
- **WHEN** a reader searches `SKILL.md` for an exclamation mark that is followed by a backtick
- **THEN** no match exists

### Requirement: REQ-SKILL-002 Rewrite rubric
The skill SHALL tell Claude to rewrite the text after `/boost` into the sections Task, Context, Requirements, and Output, and then to act on the rewritten prompt. It SHALL tell Claude to name only tools that it has in the session, to put each tool reference in the sentence that needs it, and to write no trailing tool list. The file SHALL state the date and the `OPTIMIZER_PROMPT_VERSION` of the extension rubric that it was written from.

Refs: REQ-ENH-006, ADR-002

#### Scenario: SCN-SKILL-002-1 The four sections
- **WHEN** a reader opens `SKILL.md`
- **THEN** it names `Task`, `Context`, `Requirements`, and `Output`, and it holds `$ARGUMENTS`

#### Scenario: SCN-SKILL-002-2 No fitting tool
- **WHEN** the user boosts a prompt for which the session has no fitting tool
- **THEN** the rewritten prompt names no tool

### Requirement: REQ-SKILL-003 Install from a GitHub marketplace repository
A public GitHub repository SHALL hold the plugin and a `.claude-plugin/marketplace.json` that lists it. A user SHALL install the skill with the marketplace and plugin commands that the facts record names. `claude plugin validate` SHALL pass on the plugin. The plugin files SHALL not be in the VSIX.

Refs: REQ-REL-003

#### Scenario: SCN-SKILL-003-1 Validation
- **WHEN** `claude plugin validate plugins/boost` runs
- **THEN** it exits 0

#### Scenario: SCN-SKILL-003-2 The VSIX
- **WHEN** the `vsix` rule of the release check runs
- **THEN** no listed path starts with `plugins/` or `.claude-plugin/`

### Requirement: REQ-SKILL-004 Dated host facts
`docs/eval/claude-code-facts.md` SHALL name the Claude Code CLI version and the date of the check. It SHALL state the result for the skill frontmatter, the `$ARGUMENTS` rule, the plugin manifest, the marketplace manifest, and the install commands.

#### Scenario: SCN-SKILL-004-1 The record
- **WHEN** a reader opens the facts record
- **THEN** it holds a CLI version, a date, and one result for each of the five items

### Requirement: REQ-SKILL-005 Probe measurement
The probe SHALL be measured only by the unique cloners and the stars of the marketplace repository. The skill SHALL send no data. `docs/eval/skill-probe.md` SHALL record the repository URL, the publish date, the two numbers on day 30, the 30-day installs and stars of the extension, and the decision by ADR-003.

Refs: ADR-003

#### Scenario: SCN-SKILL-005-1 Day 30
- **WHEN** 30 days passed after the publish date
- **THEN** the record holds the cloners, the stars, the extension numbers, and one decision line: `reopen the plugin port` or `keep it parked`
