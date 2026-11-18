# Tasks

Size: about 4 evenings, most of them owner work. This change needs changes 001, 002, and 003 in the archive. Tasks marked (owner) need a person: an agent prepares the file and stops for the owner.

## 1. Identity

- [ ] 1.1 (owner) Register the publisher on the VS Code Marketplace and the namespace on Open VSX, with the id `promptbooster` or `sonqh`. Store both tokens as repository secrets. Write `docs/release/publisher.md` and set `publisher` in `package.json`. [REQ-REL-008] Verify: `test -s docs/release/publisher.md && grep -Eq "^publisher: (promptbooster|sonqh)$" docs/release/publisher.md && grep -q "Open VSX" docs/release/publisher.md && test "$(sed -n 's/^publisher: //p' docs/release/publisher.md)" = "$(node -p "require('./package.json').publisher")"`
- [ ] 1.2 Add `icon.png` (128 by 128 pixels or more). Delete `icon.jpg`. Change `icon` in `package.json`, the icon path in `ChatParticipantHandler.ts`, and the `vsix` rule. [REQ-REL-009] Verify: `node -e "const b=require('fs').readFileSync('icon.png');process.exit(b.toString('latin1',1,4)==='PNG'&&b.readUInt32BE(16)>=128&&b.readUInt32BE(20)>=128?0:1)" && ! test -e icon.jpg && ! grep -rq "icon.jpg" src package.json && npm run compile && node scripts/check-release.mjs --rule vsix`

## 2. Evidence and listing text

- [ ] 2.1 Write `scripts/check-ab.mjs` with the rule of REQ-REL-010 and a `--self-test` flag that runs the four scenarios on built-in sample data. [REQ-REL-010] Verify: `node scripts/check-ab.mjs --self-test`
- [ ] 2.2 (owner) Fill `id` and `expected_tools` for 20 prompts in `docs/eval/ab-manual-0.3.0.csv` and commit. Then run each prompt raw and boosted in Copilot agent mode and fill the other four columns. Do not repeat the run. [REQ-REL-010] Verify: `test -f docs/eval/ab-manual-0.3.0.csv && node scripts/check-ab.mjs docs/eval/ab-manual-0.3.0.csv`
- [ ] 2.3 Add the rule `tagline` to `scripts/check-release.mjs`. Set `displayName` and `description` in `package.json` and the README tagline to the text for the recorded outcome. [REQ-REL-011] Verify: `node scripts/check-release.mjs --list | grep -q "tagline" && node scripts/check-release.mjs --rule tagline`

## 3. Listing assets

- [ ] 3.1 (owner) Record `media/demo.gif` (30 seconds or less) and three screenshots `media/screenshot-1.png` to `media/screenshot-3.png`. Link them in the README. Add `keywords`, `bugs`, and `homepage` to `package.json`. Keep `media/` out of the VSIX. [REQ-REL-012] Verify: `test -s media/demo.gif && test "$(ls media/screenshot-*.png | wc -l)" -ge 3 && grep -q "media/demo.gif" README.md && test "$(grep -c "media/screenshot-" README.md)" -ge 3 && node -e "const p=require('./package.json');process.exit(p.keywords&&p.keywords.length>0&&p.bugs&&p.homepage?0:1)" && npm run compile && node scripts/check-release.mjs --rule vsix`
- [ ] 3.2 Add `.github/ISSUE_TEMPLATE/bug.yml`, `feedback.yml`, and `config.yml` with a Discussions link. Link Discussions in the README. The owner turns Discussions on in the repository settings. [REQ-REL-013] Verify: `test -f .github/ISSUE_TEMPLATE/bug.yml && test -f .github/ISSUE_TEMPLATE/feedback.yml && grep -q "discussions" .github/ISSUE_TEMPLATE/config.yml && grep -q "discussions" README.md`

## 4. Release

- [ ] 4.1 Write `scripts/smoke-vsix.mjs` and `src/test/smoke/activation.test.ts`. Run it and commit `docs/release/smoke-0.3.0.md`. [REQ-REL-014] Verify: `npm run package && node scripts/smoke-vsix.mjs && test -s docs/release/smoke-0.3.0.md`
- [ ] 4.2 Add `.github/workflows/release.yml` for tags `v*`: the full release check, the package build, the smoke script, then `vsce publish` and `ovsx publish` with the same file. [REQ-REL-015] Verify: `test -f .github/workflows/release.yml && grep -q "check-release.mjs --all" .github/workflows/release.yml && grep -q "smoke-vsix" .github/workflows/release.yml && grep -q "vsce publish" .github/workflows/release.yml && grep -q "ovsx publish" .github/workflows/release.yml`
- [ ] 4.3 (owner) Bump the version to 0.3.0, move the `Unreleased` notes of the CHANGELOG under `[0.3.0]`, run the gate, and push the tag `v0.3.0`. An agent does not do this task. [REQ-REL-015] Verify: `test "$(node -p "require('./package.json').version")" = "0.3.0" && npm run compile && npm run lint && node scripts/check-release.mjs --all && npx -y spec-ctx@0.6.0 check --strict`

## Workflow follow-up

- Archive with `openspec archive 004-marketplace-launch -y`, then run `specctx build`.
- Day 90 after the release: apply the kill rule of ADR-003.
