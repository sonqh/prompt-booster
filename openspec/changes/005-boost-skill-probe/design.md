# Design

## Context

- The optimizer rubric of the extension is the text of `SYSTEM_PROMPTS.OPTIMIZATION` in `src/core/prompts/SystemPrompts.ts`: the sections Task, Context, Requirements, and Output, tool references inline in the sentence that needs them, and no trailing `Tools` section.
- In Claude Code the model that reads the skill is also the agent that has the tools. It knows its own tool list, so the skill needs no inventory and no scorer.
- A skill with a shell substitution must quote the prompt of the user with care. A skill with no script has no such risk, because `$ARGUMENTS` enters the prompt as text.
- ADR-003 rules out remote telemetry. A skill that is installed from git reports no install count. GitHub shows unique cloners for 14 days at a time and stars without a limit.
- The facts about skills and plugin marketplaces in the design are dated 2026-09-06 for CLI 2.1.232.

## Goals / Non-Goals

**Goals:**
- A user installs the skill from a GitHub repository and runs `/boost <rough prompt>`.
- The skill handles no secret and runs no code.
- After 30 days the owner has two numbers and a written decision.

**Non-Goals:**
- The same output as the extension. The skill has no workspace gatherer, cache, or feedback loop.
- A build step. The skill is written by hand.
- Marketplace review or promotion beyond one README link.

## Decisions

- The skill is one hand-written `SKILL.md`. The recut proposed a generator that builds the file from `src/core/prompts/` with a drift check in CI. The lead ruled it out: a generator and a prompt split in core cost more than the probe is worth before anybody uses it. The cost is that the rubric can drift from the extension. The file states the date and the `OPTIMIZER_PROMPT_VERSION` that it was written from. Refs: REQ-SKILL-001, REQ-SKILL-002
- The plugin folder holds only `.md` and `.json` files. No script, no hook, no `.mcp.json`, and no shell substitution in the skill text. A `Verify:` line checks this. Refs: REQ-SKILL-001
- The skill tells Claude to rewrite the text after `/boost` into the four sections, to name only tools that it has in this session, with `mcp__server__tool` names for MCP tools, to put each tool in the sentence that needs it, and then to act on the rewritten prompt. With no fitting tool it names none. Refs: REQ-SKILL-002, ADR-002
- The source lives in this repository under `plugins/boost/`, with `.claude-plugin/marketplace.json` at the root. The owner copies both to a separate public repository, and that repository is the install source. A shared repository would mix its cloners with the cloners of the extension. The alternative, the skill only in the other repository, would put it outside this spec tree. Refs: REQ-SKILL-003, REQ-SKILL-005
- The first task checks the current skill frontmatter, the `$ARGUMENTS` rule, the plugin manifest, the marketplace manifest, and the install commands, and writes `docs/eval/claude-code-facts.md` with the CLI version and the date. A difference changes the files of the next task and not the scope. Refs: REQ-SKILL-004
- `docs/eval/skill-probe.md` records the marketplace repository URL and the publish date. On day 30 the owner adds the unique cloners (two 14-day readings and the last two days), the stars, the 30-day installs of the extension on both stores, its stars, and the decision by the rule of ADR-003. Refs: REQ-SKILL-005, ADR-003

## Risks / Trade-offs

- The skill and the extension give different rewrites. Mitigation: the README of the skill says that it is a probe with no workspace context.
- Cloners count bots and CI. Mitigation: the record also holds stars, and the decision reads both.
- The skill format changes. Mitigation: the facts record is dated, and one file changes.
- Nobody finds the skill. Mitigation: one link from the extension README and listing. A low number is a valid result of a probe.
