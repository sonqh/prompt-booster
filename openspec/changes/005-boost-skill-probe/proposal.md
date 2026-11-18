# Proposal

## Why

The approved design `docs/plans/claude-code-plugin-design.md` ports PromptBooster to Claude Code as a full plugin: a CLI, three hooks, file stores, and a refactor of core. It is about three milestones of work, and nobody knows if Claude Code users want it. The roadmap in ADR-003 parks that port and asks a cheaper question first: does a `/boost` command get any use at all?

This change answers it with the smallest thing that can be installed: one skill file with instructions and nothing else. Claude does the rewrite itself, with the same rubric that the extension gives its optimizer. No script runs, no config file is read, and no secret is handled.

The probe is measured for 30 days by the unique cloners and the stars of the repository that hosts it. If those numbers beat the 30-day installs or stars of the extension, the parked port can be reopened.

## What Changes

- A dated check of the Claude Code skill and marketplace format, because the facts in the design are from 2026-09-06.
- One hand-written `SKILL.md` for `/boost`, with a plugin manifest and a marketplace manifest, under `plugins/boost/`.
- A public GitHub marketplace repository that holds a copy, so a user can install the skill with two commands and so the numbers are not mixed with the extension repository.
- A record of the 30-day numbers and the decision.

Out of scope: a CLI, hooks, telemetry, a cache, MCP inventory, a generator that builds the skill from source, every part of the parked plugin design.

## Capabilities

### New Capabilities
- `boost-skill`: the instruction-only `/boost` skill for Claude Code and the way its use is measured.

### Modified Capabilities

None.

## Impact

- New: `plugins/boost/.claude-plugin/plugin.json`, `plugins/boost/skills/boost/SKILL.md`, `plugins/boost/README.md`, `.claude-plugin/marketplace.json`, `docs/eval/claude-code-facts.md`, `docs/eval/skill-probe.md`.
- Changed: `.vscodeignore` (keep `plugins/` and `.claude-plugin/` out of the VSIX), `README.md` (one link).
- No change under `src/`. The extension does not change.
- Owner actions: create the public marketplace repository, read the numbers on day 30.
