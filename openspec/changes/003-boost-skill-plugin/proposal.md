# Proposal

## Why

Chat participants are deprecated and do not run on the Copilot harness. The first-party migration page maps a participant slash command to an explicitly invoked skill in an agent plugin. ADR-004 takes that road: the product is one plugin, `prompt-booster`, with one skill, `/prompt-booster:boost`.

The skill keeps the one idea of PromptBooster that still fits. A rough request becomes a clear task with facts from the workspace, checks that say when it is done, and the names of the tools to call first. In a skill, the model that rewrites the request is the agent that has the tools. So the skill needs no tool discovery, no scorer, no cache, and no stored state. It is one file with instructions. It reads no config file and handles no secret.

A known competitor exists: the `boost-prompt` skill in `github/awesome-copilot`. The difference that this skill claims is the named first tools and the stop for the OK of the user. Change 004 tests that claim.

## What Changes

- A plugin folder `plugin/` with the manifests that the spike confirmed, `skills/boost/SKILL.md`, a README, and a LICENSE.
- The skill text: 600 words at most, `disable-model-invocation: true`, and a fixed output contract.
- A script `scripts/check-plugin.mjs` that fails when the folder holds a file that is not allowed or when the skill breaks a rule. CI runs it.
- A validator run on the plugin, and an install matrix with one row per host.

Out of scope: a script, a hook, an MCP server, telemetry, a generator, the engine of the extension (parked by ADR-004), the README claim and the release (change 004).

## Capabilities

### New Capabilities

None. Change `002-plugin-spike` adds `boost-skill`. This change extends it.

### Modified Capabilities
- `boost-skill`: adds the skill, its output contract, the plugin folder rule, and the install rule.

## Impact

- New: `plugin/plugin.json`, `plugin/.claude-plugin/plugin.json`, `plugin/skills/boost/SKILL.md`, `plugin/README.md`, `plugin/LICENSE`, `scripts/check-plugin.mjs`, `docs/install-matrix.md`.
- Changed: `.github/workflows/ci.yml` (one step), `.vscodeignore` (keep `plugin/` out of a local VSIX build).
- No change under `src/`.
- Owner actions: the validator run and the install on each host need the owner machine.
