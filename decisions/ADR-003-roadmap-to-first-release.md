# ADR-003 Roadmap to the first public release

**Superseded in part by ADR-004 on 2026-11-18.** Decisions 1, 2, 4, 8, and 9 no longer apply, and ADR-004 replaces the kill rule of decision 7. Decisions 3, 5, and 6 stand. The changes that this record names are parked under `openspec/parked/`. The text below is kept as it was written.

Status: proposed. Date: 2026-11-18. Each decision below is proposed. The owner accepts it by merging the pull request that holds this file.

## Context

The audit of 2026-11-18 found a working extension with no public release, three designs with no code, and no evidence for its main claim. The product owner role and the architect role agreed on one roadmap. This record fixes it, so that a later session does not reopen each point.

## Decision

1. **Launch channel: VS Code Marketplace and Open VSX.** Proposed, owner accepts by merging the PR. The first release is version 0.3.0, the same VSIX on both stores. Changes in order: `001-release-hygiene`, `002-mcp-v2-closeout`, `003-retire-operation-modes`, `004-marketplace-launch`. The estimate is about 15 evenings.

2. **The full Claude Code plugin port and the host-neutral core are parked.** Proposed, owner accepts by merging the PR. Both designs move to `openspec/parked/`. They stay parked until the `/boost` skill probe (change `005-boost-skill-probe`) beats the 30-day installs or stars of the extension. The probe is one instruction-only skill file. Its use is read from the unique cloners and the stars of its GitHub repository.

3. **The Meta-MCP orchestrator is archived.** Proposed, owner accepts by merging the PR. No change exists for it and none is planned. `docs/meta-mcp-orchestrator-spec.md`, its duplicate, and `docs/plan-meta-mcp-orchestrator.md` stay as history.

4. **Agensi is not a launch channel.** Proposed, owner accepts by merging the PR. No task prepares a listing there before the first release.

5. **No paid tier before day 90.** Proposed, owner accepts by merging the PR. Day 0 is the day that 0.3.0 is live on a store.

6. **No remote telemetry.** Proposed, owner accepts by merging the PR. The extension and the skill send no usage data. Evidence comes from store install counts, GitHub numbers, issues, and manual records in `docs/eval/`.

7. **Kill rule.** Proposed, owner accepts by merging the PR. On day 90, if the extension has under 50 installs over both stores and zero feedback from a person outside the project (an issue, a discussion, a review, or a message), the project is frozen. Frozen means security fixes only.

8. **The background probe is cut.** Proposed, owner accepts by merging the PR. The MCP probe runs only from the `Refresh MCP Tool Index` command. This narrows ADR-002 section 3, which allowed a background run.

9. **The listing claims only what a recorded test shows.** Proposed, owner accepts by merging the PR. The golden set gates precision at 0.8 and recall at 0.6. One manual A/B run on 20 prompts picks the listing text. A fail outcome changes the text and does not stop the release. The run is not repeated.

## Consequences

- The plugin design that the owner approved on 2026-09-09 is replaced by the skill probe until the trigger of decision 2 fires.
- The README cannot say that core has no `vscode` import until the parked core design is done.
- Operation modes and four dead settings leave the product before the release (change 003). That change needs the owner, because users can see it.
- The owner has work that no agent can do: store accounts, the demo GIF, the 20 golden labels, the manual A/B run, the tag, and the day-30 and day-90 readings.

Refs: ADR-001, ADR-002, ADR-004, REQ-PROBE-001, REQ-SKILL-005
