# Tasks

Size: about 3 evenings. This change needs changes 001, 002, and 003. Tasks marked (owner) need a person. An agent prepares the file and stops.

## 1. Evidence

- [ ] 1.1 Write `scripts/check-ab.mjs` with the rule of REQ-SKILL-012, the flags `--labels-only` and `--readme <file>`, and a `--self-test` flag that runs the scenarios of REQ-SKILL-012 and REQ-SKILL-013 on built-in sample data. [REQ-SKILL-012, REQ-SKILL-013] Verify: `node scripts/check-ab.mjs --self-test`
- [ ] 1.2 (owner) Write 20 vague requests of your own into `docs/eval/ab-skill-0.1.0.csv` with `id` and `expected_tools`. Leave the other four columns empty. Commit before the run. [REQ-SKILL-012] Verify: `test -f docs/eval/ab-skill-0.1.0.csv && node scripts/check-ab.mjs --labels-only docs/eval/ab-skill-0.1.0.csv`
- [ ] 1.3 (owner) On the Copilot harness, send each request raw and as `/prompt-booster:boost <request>` with the plan accepted without edits. Fill the four columns and the `#` lines for the date, the model, and the versions. Do not repeat the run. [REQ-SKILL-012] Verify: `node scripts/check-ab.mjs docs/eval/ab-skill-0.1.0.csv && grep -q "^# date: " docs/eval/ab-skill-0.1.0.csv`
- [ ] 1.4 Put the text for the recorded outcome in the first screen of the README, with the hosts of the spike `hosts:` line, the install command, and a link to the record. Add the check to `.github/workflows/ci.yml`. [REQ-SKILL-013, REQ-REL-005] Verify: `node scripts/check-ab.mjs --readme README.md docs/eval/ab-skill-0.1.0.csv && head -30 README.md | grep -q "/prompt-booster:boost" && head -30 README.md | grep -q "February 2027" && grep -q "check-ab" .github/workflows/ci.yml`

## 2. Release

- [ ] 2.1 Add `.github/ISSUE_TEMPLATE/feedback.yml` and `config.yml` with a Discussions link. Link both in the README. The owner turns Discussions on in the repository settings. [REQ-SKILL-015] Verify: `test -f .github/ISSUE_TEMPLATE/feedback.yml && grep -q "discussions" .github/ISSUE_TEMPLATE/config.yml && grep -q "discussions" README.md && grep -q "issues/new" README.md`
- [ ] 2.2 Add a plugin entry `[plugin 0.1.0]` with the A/B outcome to `CHANGELOG.md`. Create `docs/eval/signals.md` with the table header and the rule of the day-90 decision. [REQ-SKILL-014, REQ-SKILL-005] Verify: `grep -q "^## \[plugin 0.1.0\]" CHANGELOG.md && grep -Eq "^\| date \| stars \| cloners_14d \| external_feedback \|" docs/eval/signals.md && test "$(node -p "require('./package.json').version")" = "0.2.4"`
- [ ] 2.3 (owner) Run the gate and make the tag `v0.1.0`. An agent does not do this task. [REQ-SKILL-014] Verify: `node scripts/check-plugin.mjs && node scripts/check-ab.mjs --readme README.md docs/eval/ab-skill-0.1.0.csv && npx -y spec-ctx@0.6.0 check --strict && git tag --list | grep -qx "v0.1.0"`
- [ ] 2.4 (owner) Open the pull request to `github/awesome-copilot` and write its URL to `docs/release/awesome-copilot-pr.md`. [REQ-SKILL-015] Verify: `grep -Eq "^pr: https://github.com/github/awesome-copilot/pull/[0-9]+$" docs/release/awesome-copilot-pr.md`
- [ ] 2.5 (owner) One week after the tag, add the first row to `docs/eval/signals.md`. Add one row each week, and the decision line on day 90. [REQ-SKILL-005] Verify: `grep -Eq "^\| [0-9]{4}-[0-9]{2}-[0-9]{2} \| [0-9]+ \| [0-9]+ \| [0-9]+ \|" docs/eval/signals.md`

## Workflow follow-up

- Archive with `openspec archive 004-evidence-and-release -y`, then run `specctx build`. Archive after the first weekly row. The day-90 decision line is owner work after the archive.
