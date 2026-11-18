# Design

## Context

The source is `docs/plans/claude-code-plugin-design.md`. Its section 10 holds six decisions of 2026-09-09 that bind M1 to M3. This file restates them and adds what the audit of 2026-11-18 changed.

- A `UserPromptSubmit` hook can add context and can block. It cannot replace the prompt. So the rewrite enters through a skill whose shell substitution runs before the model sees the message.
- Tool hooks report each real tool call with its runtime name `mcp__<server>__<tool>`. That is direct evidence of use, which the VS Code host never had.
- The plugin reuses core code only after change `003-host-neutral-core`. The scorer and the Phase E services are clean today. `PromptOptimizationService` and `ILanguageModelProvider` are not.
- The plugin reads `~/.claude.json`, which holds `env` values of MCP servers.

## Goals / Non-Goals

**Goals:**
- `/boost <rough prompt>` gives a rewrite that names real tools of the user.
- With no MCP server, the rewrite equals a boost with no catalog.
- Telemetry holds tool names and times only.
- Each milestone ends with exit criteria that a command can check.

**Non-Goals:**
- A rewrite of prompts that the user did not boost.
- A parse of Claude Code transcripts.
- One learning store for both hosts.

## Decisions

- The first task checks section 2 of the design again on the current CLI and writes `packages/claude-code-plugin/FACTS.md` with the CLI version, the date, and each difference. A difference that breaks a requirement stops the change for a plan update. The design names this as the first M1 step. Refs: REQ-PLUG-001
- The plugin lives in this repository at `packages/claude-code-plugin/` and imports `src/core`. One scorer and one `OPTIMIZER_PROMPT_VERSION` serve both hosts. The cost is one release cadence. Design decision 10.1. Refs: REQ-PLUG-002
- `/boost` passes the prompt on stdin through a heredoc with a quoted delimiter, so the shell does not read the prompt text. When the current CLI does not support a multi-line heredoc in a substitution, the skill uses the quoted single-line form. Design section 4. Refs: REQ-PLUG-003
- The optimizer runs through headless `claude -p` by default. It needs no key. An API key provider comes in M2 for users who want isolation. Design decision 10.2. Refs: REQ-PLUG-005, REQ-PLUG-010
- M1 injects MCP tools only. Skills and subagents are in the inventory fingerprint from M1 and in scoring from M2. Design decision 10.5. Refs: REQ-PLUG-004, REQ-PLUG-010
- The rewrite uses the literal runtime name `mcp__server__tool`. The VS Code host needs the "semantic identifier" guidance, and this host does not. Refs: REQ-PLUG-005
- The tool-use hook appends one JSON line per call and reads nothing. It stores `tool_name`, `tool_use_id`, `duration_ms`, and `timestamp`. It never stores `tool_input` or `tool_response`, which can hold file content and credentials. Refs: REQ-PLUG-006
- A boosted prompt links to a session by the SHA-256 of the rewritten prompt. When the user edits the rewrite, the link fails and the telemetry stays unlinked. That is not an error and gives no label. Refs: REQ-PLUG-007
- All state is under `~/.claude/promptbooster/` with mode `0600`. The first task checks if an official data folder for a plugin exists and uses it when it does. Refs: REQ-PLUG-008
- The cache key is the VS Code formula with the schema `pb-cc-cache-v1` and the inventory fingerprint in place of the catalog fingerprint. The plugin version is not in the key. Design section 6. Refs: REQ-PLUG-009, REQ-FBK-007
- Ambient hints and few-shot learning are off by default. Design decision 10.4 and ADR-002 section 6. Refs: REQ-PLUG-012, ADR-002
- The plugin installs from git or with `--plugin-dir`. Marketplace publication waits for demand. Design decision 10.3. Refs: REQ-PLUG-013
- The learning stores of the two hosts never merge. Design decision 10.6. Refs: REQ-PLUG-012
- Plugin tests use `node --test` on compiled files with file-system fixtures in a temporary folder. They need no Claude Code binary, except the tasks that run `claude plugin validate`. Refs: REQ-PLUG-002

## Risks / Trade-offs

- The hook and skill surfaces change fast. Mitigation: host contact stays in three thin handlers and the skill files, and each milestone starts with a facts check.
- `claude -p` inside a skill adds latency and ties the plugin to the local binary. Mitigation: the response cache in M2 and the API key provider.
- A Node process starts for each tool call. Mitigation: the handler appends one line and exits. Reports do the aggregation.
- The plugin reads a file with secrets. Mitigation: `env` is never stored or logged, and the README lists each file that the plugin reads and writes.
- The owner has not said if the plugin can drive a refactor of core. Mitigation: change 003 carries that refactor and stands on its own.
