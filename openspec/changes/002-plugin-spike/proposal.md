# Proposal

**Every task of this change needs the machine and the accounts of the owner: VS Code with GitHub Copilot, the Copilot CLI, and Claude Code. An agent in a cloud session can prepare the fixture and the result files. It cannot run the checks.**

## Why

ADR-004 makes one agent plugin with one skill the product. The plan rests on facts that nobody in the project has seen work:

- The VS Code page on agent plugins says that plugins are an open format across Copilot in VS Code, the Copilot CLI, and the Copilot app, and that VS Code also reads Claude-format plugins. It does not say that Claude Code installs a Copilot-format plugin.
- The migration page says that a plugin skill runs as `/plugin-name:skill-name`. The exact name on each host is not verified.
- Nobody checked that `disable-model-invocation: true` stops a host from loading the skill by itself.
- The skill must name the tools that the agent will call first. Nobody checked that the model inside a skill sees the live tool list of the host, or only a part of it behind a tool search.
- A third-party post says that VS Code 1.146 made the Copilot harness the default. No first-party source confirms the version.
- The A/B test of change 004 is manual. A headless run of the Copilot CLI with a log of tool calls would make a later test cheaper. Nobody checked that it exists.

A wrong guess on one of these costs more in changes 003 and 004 than two evenings now. This change turns each unknown into one check with one committed result file.

## What Changes

- A throwaway fixture plugin with two manifests and one skill under `docs/spike/fixture-plugin/`.
- Eight result files under `docs/spike/`, one per unknown, each with the date, the host versions, and one `result:` line per host.
- A summary `docs/spike/README.md` with the list of hosts that passed. Changes 003 and 004 read that list.

Out of scope: the real skill text (change 003), a bundled MCP server, any measurement of quality.

## Capabilities

### New Capabilities
- `boost-skill`: the `/prompt-booster:boost` skill, its plugin, and the facts and evidence behind it. This change adds only the host facts.

### Modified Capabilities

None.

## Impact

- New: `docs/spike/**`.
- No change under `src/`, `plugin/`, or `package.json`.
- Owner time: about 2 evenings on the owner machine.
