# Design

## Context

- ADR-004 fixes the A/B protocol, the pass rule, both README texts, the signals, and the kill rule. This file turns them into files and checks.
- The A/B run is manual, because no verified headless run with a tool-call log exists. Spike check 06 can change that for a later test. It does not change this one.
- GitHub shows unique cloners for the last 14 days only. A weekly reading loses nothing.
- The README first screen comes from change 001. It names the plugin as "in progress". This change replaces that part with the claim.
- The extension version is 0.2.4 and the repository has no git tag. The plugin starts at 0.1.0. The tag `v0.1.0` names the plugin release.

The two README texts:

- Pass: "PromptBooster is one skill for GitHub Copilot (VS Code, CLI) and Claude Code. Run `/prompt-booster:boost <your rough request>`. The agent restates the task with facts from your workspace, adds acceptance checks, names the tools it will call first, and waits for your OK. In our 20-prompt Copilot test, boosted requests reached the correct first tool more often than raw requests (results linked). Instructions only: no scripts, no hooks, no server, no telemetry."
- Fail: "PromptBooster is one skill for GitHub Copilot (VS Code, CLI) and Claude Code. Run `/prompt-booster:boost <your rough request>`. The agent restates the task with facts from your workspace, adds acceptance checks, lists the tools it plans to use, and waits for your OK. In our 20-prompt test it did not beat the raw request on first tool choice (results linked). Instructions only: no scripts, no hooks, no server, no telemetry."

The host list in the first sentence equals the hosts that passed the spike. The two texts above show the case where all three passed.

## Goals / Non-Goals

**Goals:**
- The README claim equals what the record allows, and a script proves it.
- The release happens with a pass or with a fail.
- On day 90 the owner decides from a written log.

**Non-Goals:**
- Statistical proof. Twenty prompts give a coarse signal.
- A fix of the skill after a fail, inside this change.
- Any data that the skill sends.

## Decisions

- The record is a CSV with the header `id,expected_tools,raw_first_tool,boosted_first_tool,raw_ok,boosted_ok` and exactly 20 data rows. `raw_ok` and `boosted_ok` are 0 or 1. Lines that start with `#` hold the date, the model, the host version, and the plugin version. Refs: REQ-SKILL-012
- The labels come first. Task 1.2 commits the file with `id` and `expected_tools` filled and the other four columns empty. Task 1.3 fills the rest. `check-ab.mjs --labels-only` accepts the first state. Git history then shows that the labels are older than the results. Refs: REQ-SKILL-012
- The outcome is `pass` when the sum of `boosted_ok` minus the sum of `raw_ok` is 3 or more and `boosted_ok` is below `raw_ok` on 2 rows at most. Every other result is `fail`. The script exits 0 for a well-formed file with either outcome and exits 1 for a malformed file. Refs: REQ-SKILL-012, ADR-004
- "Accepted without edits" means that the owner answers the OK question with a plain yes. The first tool is the first tool call after that answer for the boosted arm, and the first tool call for the raw arm. Tool calls that the agent makes to read facts before the OK question do not count. The recut plan had a three-arm headless test with a scorer arm. The engine is parked, so two manual arms are enough. Refs: REQ-SKILL-012
- `check-ab.mjs --readme README.md` reads the outcome, builds the allowed text with the host names from the `hosts:` line of `docs/spike/README.md`, and compares it with the first screen of the README. It also requires a link to the record file. CI runs it. Refs: REQ-SKILL-013, REQ-REL-005
- The issue template `feedback.yml` asks for the host, the request, and what the skill got wrong. `config.yml` links Discussions. An item counts as external feedback when a person outside the project wrote it. Refs: REQ-SKILL-015
- The awesome-copilot pull request adds the skill next to `boost-prompt`, under the public GitHub name of the owner. `docs/release/awesome-copilot-pr.md` holds one line `pr: <url>`. A rejected pull request still closes the task. The file then says so. Refs: REQ-SKILL-015
- `docs/eval/signals.md` is a table with one row per week: date, stars, unique cloners of the last 14 days, external feedback items in total. Day 0 is the date of the tag. On day 90 the owner adds one line `decision: continue` or `decision: freeze`. Freeze applies under 15 stars with zero external feedback. Refs: REQ-SKILL-005, ADR-004
- The owner makes the tag. An agent stops before it. Refs: REQ-SKILL-014

## Risks / Trade-offs

- The outcome is `fail`. Mitigation: the fail text is ready and the release goes on.
- The owner writes the requests, the labels, and the judgments. Mitigation: labels are committed first, the rule is fixed, and the record is public.
- The pull request is rejected or ignored. Mitigation: the repository itself is the second channel, and the log shows the effect.
- Weekly readings get skipped. Mitigation: a missed week is one empty row, and cloners of 14 days still cover it once.
