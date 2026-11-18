# Proposal

## Why

The skill of change 003 claims one thing that a plain "improve my prompt" skill does not: a boosted request makes the agent reach the correct first tool more often. ADR-004 says that the README states this only when a recorded test shows it. A known competitor, `boost-prompt` in `github/awesome-copilot`, is free and already listed. Without evidence, this skill is one more of the same.

ADR-004 also rules out remote telemetry. So after the release the project can learn only from what GitHub shows and from what people write. Somebody must write those numbers down each week, or the day-90 decision has no data.

## What Changes

- One manual A/B run on the Copilot harness: 20 vague requests of the owner, each sent raw and as `/prompt-booster:boost <request>` with the plan accepted without edits. The record is `docs/eval/ab-skill-0.1.0.csv`. The expected first tools are written and committed before the run. The run is not repeated.
- `scripts/check-ab.mjs` validates the record, prints `pass` or `fail`, and fails when the README claim does not match the outcome or when the README host list differs from the spike host list.
- The README first screen gets the pass text or the fail text.
- The plugin release 0.1.0: a CHANGELOG entry and the tag `v0.1.0`, which the owner makes.
- An issue template and a Discussions link.
- A pull request to `github/awesome-copilot`, with its URL in a file.
- A weekly signal log `docs/eval/signals.md` with stars, unique cloners, and external feedback items, and the day-90 decision.

Out of scope: a store listing, an automated evaluation, telemetry, a paid tier, a second A/B run.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `boost-skill`: adds the A/B record, the README claim rule, the release, the discovery channel, and the signal log.
- `release-and-packaging`: the README first screen now holds the plugin claim.

## Impact

- New: `docs/eval/ab-skill-0.1.0.csv`, `docs/eval/signals.md`, `docs/release/awesome-copilot-pr.md`, `scripts/check-ab.mjs`, `.github/ISSUE_TEMPLATE/feedback.yml`, `.github/ISSUE_TEMPLATE/config.yml`.
- Changed: `README.md`, `CHANGELOG.md`, `.github/workflows/ci.yml`.
- Owner actions that no agent can do: the 20 requests and their labels, the A/B run, the tag, the pull request, the weekly readings.
