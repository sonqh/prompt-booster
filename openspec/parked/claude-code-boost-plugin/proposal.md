# Proposal

## Why

`docs/plans/claude-code-plugin-design.md` designs a port of PromptBooster to Claude Code as a plugin. The product owner approved it on 2026-09-09. No code exists: the repository has no `packages/` folder. The README roadmap says "implementation next". This change turns the three milestones of that design into requirements and tasks, so the work can start from a checked plan.

Two facts changed after the approval:

- The design says that `src/core/**` has no `vscode` import. That is false today. Change `003-host-neutral-core` makes it true, and this change depends on it.
- Section 2 of the design lists Claude Code facts from 2026-09-06 for CLI 2.1.232. They are more than two months old. The first task checks them again.

## What Changes

- M1: a plugin package at `packages/claude-code-plugin/` with a `/boost` skill, a `claude-boost` CLI, an inventory of MCP servers from four scopes, the shared scorer, an optimizer call through `claude -p`, a tool-use hook that writes telemetry, and a prompt-submit hook that links a boosted prompt to its session.
- M2: a file-backed response cache, a `/boost-report` skill, skills and subagents in scoring, and an optimizer provider that uses an API key.
- M3: observed-use labels, opt-in few-shot learning, an opt-in ambient hint mode, a runtime tool inventory, and packaging for a git install.

Out of scope: Marketplace publication of the plugin, the Agent SDK host (option C of the design), headless `--resume` (option D), a shared learning store for both hosts.

## Capabilities

### New Capabilities
- `claude-code-boost-plugin`: the Claude Code plugin that rewrites a prompt on `/boost` and measures real tool use.

### Modified Capabilities

None.

## Impact

- New folder `packages/claude-code-plugin/` with its own `package.json`, build, and tests (`node --test`).
- Reuse of `src/core` through imports: `ToolAffinityClassifier`, `PromptOptimizationService`, `PromptResponseCache`, `PromptFeedbackLog`, `PromptLearningStore`, `McpServerProbe`, `SystemPrompts`.
- Files on the user machine under `~/.claude/promptbooster/`.
- No change to the VS Code extension behavior.
