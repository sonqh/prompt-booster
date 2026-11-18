# Design

## Context

First-party pages, read by the lead on 2026-11-18 (ADR-004 lists them):

- Chat participants are deprecated and do not run on the Copilot harness.
- An agent plugin has a `plugin.json` manifest and can hold skills. Install paths: a marketplace, a Git URL or a local folder (`Chat: Install Plugin from Source`), a deep link, and `/plugin` in a Copilot session. Marketplace management is in preview.
- Participant slash commands map to skills with `disable-model-invocation: true`, and plugin skills run as `/plugin-name:skill-name`.
- VS Code supports Copilot, Claude, and legacy OpenPlugin plugin formats.

Not verified by anybody: the items in the proposal. Claude Code expects its manifest at `.claude-plugin/plugin.json`. That comes from the parked plugin design of 2026-09-06 and is itself a dated fact.

The plan of ADR-004 puts the plugin in the folder `plugin/` of this repository. A Git URL install may need the plugin at the root of a repository. The owner question on a separate repository depends on this.

## Goals / Non-Goals

**Goals:**
- Each unknown has a result that a later session can read without the owner.
- The result files say which hosts the first release names.
- A negative result is a valid result. It changes a later change and not this one.

**Non-Goals:**
- A fix for a host that fails.
- A generic test harness.
- Screenshots or recordings.

## Decisions

- One file per unknown under `docs/spike/`, named `01-install.md` to `08-legacy-extension.md`. Each file starts with `date:` and one `version:` line per host, holds the exact steps, and ends with one line `result: <host>: <pass|fail|n/a> <note>` per host. The host ids are `vscode-copilot`, `copilot-cli`, `claude-code`, and `copilot-app`. A fixed line shape lets a `grep` verify each task. Refs: REQ-SKILL-004
- The fixture plugin has a root `plugin.json`, a `.claude-plugin/plugin.json`, and one skill `skills/echo/SKILL.md` that prints a marker and its argument. It lives under `docs/spike/fixture-plugin/` and is never the product. Check 01 installs it from a local folder, from a Git URL of a branch, and from a subfolder path, and records which forms work. Refs: REQ-SKILL-006
- Check 01 also records the validator command of each host, for example `claude plugin validate`. Change 003 uses what this check finds. Refs: REQ-SKILL-006
- Check 04 configures at least one MCP server with five or more tools, asks the skill to list every tool name that it can call, and records the count against the real count. It notes a deferred tool search when the host has one. Refs: REQ-SKILL-007
- Check 05 records the VS Code version from `code --version` and the Session Target on a clean profile, and the first version whose release notes name the Copilot harness as default. Refs: REQ-SKILL-008
- Check 06 tries `copilot -p` and `claude -p --output-format stream-json` with the fixture plugin and records if the output names the first tool call. A fail keeps the A/B test of change 004 manual and changes nothing else. Refs: REQ-SKILL-007
- Check 07 tries the Copilot app. The result `n/a` is allowed when the owner has no access. Refs: REQ-SKILL-006
- Check 08 runs `Boost This Prompt` and `Process Prompt File` of the frozen extension one time on the Copilot harness. The result feeds the legacy section of the README. Refs: REQ-SKILL-008, REQ-REL-005
- `docs/spike/README.md` has one line `hosts: <ids>` with the hosts that pass checks 01, 02, and 03, and one line `invocation: <host>: <name>` per such host. Refs: REQ-SKILL-004

## Risks / Trade-offs

- Claude Code does not load the same folder. Mitigation: the result removes Claude Code from the host list, or change 003 adds a second manifest layout. The skill text stays one file.
- A subfolder cannot be installed from a Git URL. Mitigation: the owner question on a separate repository gets its answer from check 01.
- The host hides most tools from the skill. Mitigation: change 003 already has the rule for fewer than 3 visible tools, and check 04 says how common that case is.
- The facts go stale. Mitigation: each file has a date and versions. A later change checks again only what it uses.
