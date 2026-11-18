# Tasks

Size: about 2 evenings, after the release of change `004-marketplace-launch`. Tasks marked (owner) need a person.

## 1. Skill

- [ ] 1.1 Check the current Claude Code skill and plugin marketplace format. Write `docs/eval/claude-code-facts.md` with the CLI version, the date, and the five results of REQ-SKILL-004. [REQ-SKILL-004] Verify: `test -s docs/eval/claude-code-facts.md && grep -q "CLI version" docs/eval/claude-code-facts.md && grep -q "ARGUMENTS" docs/eval/claude-code-facts.md && grep -qi "marketplace" docs/eval/claude-code-facts.md`
- [ ] 1.2 Write `plugins/boost/skills/boost/SKILL.md` by hand from the rubric in `src/core/prompts/SystemPrompts.ts`. Add `plugins/boost/.claude-plugin/plugin.json`, `plugins/boost/README.md`, and `.claude-plugin/marketplace.json`. [REQ-SKILL-001, REQ-SKILL-002] Verify: `test -z "$(find plugins/boost -type f ! -name '*.md' ! -name '*.json')" && node -e "const s=require('fs').readFileSync('plugins/boost/skills/boost/SKILL.md','utf8');process.exit(['Task','Context','Requirements','Output','\$ARGUMENTS','OPTIMIZER_PROMPT_VERSION'].every(w=>s.includes(w))&&!s.includes('!'+String.fromCharCode(96))?0:1)" && node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"`
- [ ] 1.3 Validate the plugin with the CLI. Keep `plugins/` and `.claude-plugin/` out of the VSIX. [REQ-SKILL-003] Verify: `claude plugin validate plugins/boost && npm run compile && node scripts/check-release.mjs --rule vsix`

## 2. Probe

- [ ] 2.1 (owner) Create the public marketplace repository, copy `plugins/boost` and `.claude-plugin/marketplace.json` to it, and install the skill from it one time. Write the URL and the publish date to `docs/eval/skill-probe.md`. Link the repository in the README. [REQ-SKILL-003, REQ-SKILL-005] Verify: `grep -Eq "^repository: https://github.com/[^ ]+$" docs/eval/skill-probe.md && grep -Eq "^published: [0-9]{4}-[0-9]{2}-[0-9]{2}$" docs/eval/skill-probe.md && grep -q "$(sed -n 's/^repository: //p' docs/eval/skill-probe.md)" README.md`
- [ ] 2.2 (owner) On day 30, add the cloners, the stars, the extension numbers, and the decision to `docs/eval/skill-probe.md`. [REQ-SKILL-005] Verify: `grep -Eq "^cloners_30d: [0-9]+$" docs/eval/skill-probe.md && grep -Eq "^stars_30d: [0-9]+$" docs/eval/skill-probe.md && grep -Eq "^extension_installs_30d: [0-9]+$" docs/eval/skill-probe.md && grep -Eq "^decision: (reopen the plugin port|keep it parked)$" docs/eval/skill-probe.md`

## Workflow follow-up

- Archive with `openspec archive 005-boost-skill-probe -y`, then run `specctx build`.
- When the decision is `reopen the plugin port`, move `openspec/parked/claude-code-boost-plugin` and `openspec/parked/host-neutral-core` back under `openspec/changes/` with new numbers and update their designs first.
