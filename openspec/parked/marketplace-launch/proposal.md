# Proposal

## Why

PromptBooster has no public release. The VSIX is a GitHub download, the publisher id `promptbooster` is not confirmed, the icon is a JPG, and the listing has no picture. The roadmap in ADR-003 names the first release: version 0.3.0 on the VS Code Marketplace and on Open VSX, after changes 001, 002, and 003.

The listing must not claim more than the evidence shows. The golden set of change 002 proves the scorer on labeled prompts. It does not prove that a boosted prompt makes Copilot pick the right tool first. One manual A/B run on 20 prompts gives that evidence, and the listing text follows its outcome. Both texts are written before the run:

- Pass: name `PromptBooster: Tool-Aware Prompts for Copilot`, description `Type @PromptBooster to rewrite a rough prompt with workspace context and the right MCP tools.`
- Fail: name `PromptBooster: Structured Prompts for Copilot`, description `Type @PromptBooster to turn a rough prompt into a structured one that uses your workspace context.`

## What Changes

- Confirm the publisher on both stores, or change it, and record the result.
- Replace `icon.jpg` with a PNG of at least 128 by 128 pixels.
- Add `docs/eval/ab-manual-0.3.0.csv`, the record of the manual A/B run, and `scripts/check-ab.mjs`, which reads it and prints the outcome.
- Set the listing name, the description, and the README tagline from the outcome. A release rule `tagline` fails when they differ.
- Add a demo GIF and three screenshots, issue templates, and a Discussions link.
- Add a smoke test that installs the packaged VSIX in a clean profile.
- Add a release workflow that publishes one VSIX to both stores from a tag.
- Bump the version to 0.3.0. The owner does this step as the release.

Out of scope: a paid tier, remote telemetry, Agensi as a channel (all ruled out by ADR-003), the Claude Code skill (change 005).

## Capabilities

### New Capabilities

None. Change `001-release-hygiene` adds `release-and-packaging`. This change extends it.

### Modified Capabilities
- `release-and-packaging`: adds the publisher, icon, evidence, listing, media, community, smoke, and publish rules.

## Impact

- New: `icon.png`, `media/demo.gif`, `media/screenshot-*.png`, `docs/eval/ab-manual-0.3.0.csv`, `docs/release/publisher.md`, `docs/release/smoke-0.3.0.md`, `scripts/check-ab.mjs`, `scripts/smoke-vsix.mjs`, `.github/workflows/release.yml`, `.github/ISSUE_TEMPLATE/*.yml`.
- Changed: `package.json` (`displayName`, `description`, `icon`, `publisher`, `keywords`, the version), `README.md`, `CHANGELOG.md`, `scripts/check-release.mjs`, `.vscodeignore`, `src/presentation/participants/ChatParticipantHandler.ts` (the icon path).
- Removed: `icon.jpg`.
- Owner actions that no agent can do: store accounts and tokens, the GIF, the A/B run, the tag.
