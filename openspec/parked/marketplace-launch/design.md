# Design

## Context

- `package.json` has `"publisher": "promptbooster"`, `"icon": "icon.jpg"`, and the version 0.2.4. No evidence shows that the publisher id is registered. The other candidate is `sonqh`, the GitHub account of the owner.
- `ChatParticipantHandler.register` sets the participant icon from `icon.jpg` by path.
- Change 001 adds CI, `scripts/check-release.mjs`, `npm run test:headless`, and an allow list for the VSIX. Change 003 makes every rule blocking.
- ADR-003 rules out remote telemetry. So evidence for the listing comes from a manual run that the owner records in a file.
- Several steps are owner actions with no shell check: a store account, a recording, an A/B run. Each such task ends in a committed file, and its `Verify:` checks that file.

## Goals / Non-Goals

**Goals:**
- One tagged CI run puts the same VSIX on both stores.
- The listing text equals the text that the A/B outcome allows.
- A stranger can install the VSIX in a clean profile and every command works.

**Non-Goals:**
- A second A/B run to turn a fail into a pass.
- Statistics beyond the rule below. Twenty prompts give a coarse signal, and the rule says so.
- Install counts inside the extension.

## Decisions

- The A/B record is `docs/eval/ab-manual-0.3.0.csv` with the header `id,expected_tools,raw_first_tool,boosted_first_tool,raw_ok,boosted_ok` and exactly 20 data rows. `raw_ok` and `boosted_ok` are 0 or 1. The owner fills `id` and `expected_tools` and commits them before the run. Then the owner sends each prompt to Copilot agent mode two times, raw and boosted, with the same model and the same MCP servers, and records the first tool that Copilot calls. Refs: REQ-REL-010
- The outcome is `pass` when the sum of `boosted_ok` minus the sum of `raw_ok` is 3 or more, and `boosted_ok` is below `raw_ok` on 2 prompts at most. Every other result is `fail`. The run is not repeated. `scripts/check-ab.mjs` exits 0 for a well-formed file with either outcome and prints the outcome. It exits 1 for a malformed file. The recut asked for a sign test as well. The lead kept the simple rule, because the result picks a text and does not gate the release. Refs: REQ-REL-010, ADR-003
- The release rule `tagline` reads the outcome from `check-ab.mjs` and compares `displayName` and `description` of the manifest and the first tagline of the README with the two texts in the proposal. A missing record file fails the rule. Refs: REQ-REL-011
- The publisher decision is recorded in `docs/release/publisher.md` with one line `publisher: <id>` and the date of the check on each store. The manifest must hold the same id. A store account cannot be checked from a clean clone, so the file is the evidence. Refs: REQ-REL-008
- The icon is `icon.png`, at least 128 by 128 pixels. `icon.jpg` is deleted, the participant icon path changes, and the `vsix` rule allows only `icon.png`. Refs: REQ-REL-009
- Media lives in `media/` and stays out of the VSIX. `vsce` turns the relative image links of the README into repository links. The GIF is 30 seconds or shorter. Refs: REQ-REL-012
- The smoke script unpacks the VSIX from `dist/`, starts the Electron test host with the unpacked folder as the extension and with fresh user-data and extensions folders, and asserts that the extension activates and that each command of the manifest is registered. It writes `docs/release/smoke-0.3.0.md`. Refs: REQ-REL-014, REQ-CFG-007
- `release.yml` runs on a tag `v*`: `npm ci`, the full release check, `npm run package`, the smoke script, `vsce publish --packagePath`, and `ovsx publish` with the same file. The tokens are repository secrets. Refs: REQ-REL-015
- The version bump to 0.3.0 and the tag are the last task. Only the owner does it. An agent stops there and asks. Refs: REQ-REL-015, REQ-REL-002

## Risks / Trade-offs

- The A/B outcome is `fail`. Mitigation: the fail text is ready, the release still ships, and the check binds the listing to it.
- The owner labels and judges the A/B run alone. Mitigation: `expected_tools` is committed before the run, and the record names the model and the date in a comment line.
- The publisher id `promptbooster` is taken. Mitigation: the task allows `sonqh`, and one manifest field changes.
- A store rejects the listing. Mitigation: the smoke test and `vsce package` run in CI before the publish step.
