# ADR-004 Plugin first: one skill, a frozen extension, a parked engine

Status: proposed. Date: 2026-11-18. The owner accepts this record by merging the pull request that holds it.

It supersedes decisions 1, 2, 4, 8, and 9 of ADR-003. It keeps decisions 3 (Meta-MCP archived), 5 (no paid tier before day 90), and 6 (no remote telemetry). It replaces the kill rule of decision 7 with decision 9 below.

## Context

On 2026-11-18 the owner opened `@PromptBooster` in VS Code and got a banner: chat participants are deprecated and are not supported by the Copilot harness. The lead read the first-party pages the same day.

Facts from those pages:

- Chat participants are deprecated and do not run on the Copilot harness. The API stays only for the Local harness. Source: https://code.visualstudio.com/api/extension-guides/ai/chat
- VS Code has two harnesses. Local is the legacy agent of the editor. Copilot is the runtime that the editor shares with the Copilot CLI and the Copilot app. The Local harness is deprecated and is removed in February 2027. Until then a user can pick Local under Session Target. Source: https://code.visualstudio.com/docs/agents/run/move-to-copilot
- A participant has no automatic conversion. Its slash commands map to skills that the user invokes (`disable-model-invocation: true`). A plugin skill runs as `/plugin-name:skill-name`. Participant history, feedback events, and response parts have no mapping. An MCP server has no access to VS Code APIs. Source: https://code.visualstudio.com/docs/agent-customization/migrate-customizations
- An agent plugin has a `plugin.json` manifest and can hold skills, MCP servers, agents, instructions, hooks, and commands. The page calls it an open format across Copilot in VS Code, the Copilot CLI, and the Copilot app, and says that VS Code also reads Claude-format plugins. Install paths: a marketplace, a Git URL or a local folder, a deep link, `/plugin`. Marketplace management is in preview. The page shows no way for an extension to bundle a plugin. Source: https://code.visualstudio.com/docs/agent-customization/agent-plugins
- Extension tools and the Language Model API are current, for extension commands and views. Sources: https://code.visualstudio.com/api/extension-guides/ai/tools and https://code.visualstudio.com/api/extension-guides/ai/language-model

Facts from the repository:

- The manifest contributes one chat participant and no language model tool. The headline flow lives in the participant handler and in `RealtimeModeStrategy`.
- `MCPToolRegistry` does not read `.mcp.json` at the workspace root or `~/.copilot/mcp-config.json`, the locations of the Copilot harness.

Not verified: the VS Code version that made the Copilot harness the default, and if Claude Code installs a Copilot-format plugin unchanged. Change `002-plugin-spike` checks both.

The roadmap of ADR-003 would have published an extension whose main entry does not run on the default harness and ends in February 2027.

## Decision

1. **The product is one agent plugin, `prompt-booster`, with one skill, `/prompt-booster:boost`.** The user invokes the skill. It holds instructions only: no script, no hook, no MCP server, no telemetry. It lives in this repository beside the extension, in the folder `plugin/`.

2. **Target hosts: Copilot in VS Code, the Copilot CLI, and Claude Code.** The Copilot app is a target when the spike shows that it loads the plugin. The README names only hosts that passed the spike.

3. **The VS Code extension is frozen and is never published to a store.** Its source stays. The README states its status. It stays usable on the Local harness until February 2027. It gets no feature and no release. Two manifest lines make it safer (change `001-repo-honesty`).

4. **The deterministic engine is parked.** Discovery, the scorer, the response cache, the feedback log, and the learning store stay in the frozen extension with their 155 tests. The engine comes back as a local MCP server only when feedback asks for deterministic routing or an evaluation earns it.

5. **Known competitor: the `boost-prompt` skill in `github/awesome-copilot`.** The plugin README names it and states the difference: named first tools and a stop for the OK of the user.

6. **Discovery channel: one pull request to `github/awesome-copilot`, plus the GitHub repository.** No store listing. Agensi stays out, as in ADR-003.

7. **Evidence: one manual A/B run on the Copilot harness.** Twenty vague requests of the owner. Each runs raw and as `/prompt-booster:boost <request>` with the plan accepted without edits. The expected first tools are written before the run. The record is `docs/eval/ab-skill-0.1.0.csv` with the columns `id,expected_tools,raw_first_tool,boosted_first_tool,raw_ok,boosted_ok`. Pass means that the sum of `boosted_ok` minus the sum of `raw_ok` is 3 or more of 20, and that the boosted request is worse on 2 requests at most. Every other result is a fail. The run is not repeated. A fail changes the README text and does not stop the release.

8. **Signals: GitHub stars, unique cloners recorded each week, and external feedback items.** The skill sends no data.

9. **Kill rule.** On day 90 after the tag `v0.1.0`, under 15 stars with zero external feedback means that everything is frozen.

10. **Known open issue, recorded as it is.** The frozen extension still builds an unhashed catalog fingerprint that can hold `env` values of the VS Code `mcp.servers` setting, and it stores that string in workspace state. Its probe has no workspace-trust check in code. The probe is off by default. The fix is parked with the engine (`openspec/parked/mcp-v2-closeout`). The README of the extension says so.

## Consequences

- Active changes, in order: `001-repo-honesty`, `002-plugin-spike`, `003-boost-skill-plugin`, `004-evidence-and-release`. About 10 evenings.
- Parked under `openspec/parked/`: `mcp-v2-closeout`, `retire-operation-modes`, `marketplace-launch`, `release-hygiene`, and `host-neutral-core`. The folder `claude-code-boost-plugin` stays as history. This record replaces it.
- The main specs under `openspec/specs/` stay. They describe the real behavior of the frozen extension.
- The feedback loop of the extension (accept, reject, edit) has no place in a skill. The first release learns only from the signals of decision 8.
- The owner has work that no agent can do: the spike on the owner machine, the 20 requests and the A/B run, the tag, the pull request, and the weekly readings.

Refs: ADR-001, ADR-002, ADR-003, REQ-CHAT-001, REQ-PROBE-001, REQ-REL-005, REQ-REL-016, REQ-SKILL-001, REQ-SKILL-005, REQ-SKILL-012
