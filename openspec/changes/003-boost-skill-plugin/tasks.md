# Tasks

Size: about 3 evenings. This change needs the result of change `002-plugin-spike`. Tasks marked (owner) need the owner machine.

## 1. Plugin folder

- [ ] 1.1 Create `plugin/` with the manifests that `docs/spike/README.md` names (default: `plugin/plugin.json` and `plugin/.claude-plugin/plugin.json`), each with the name `prompt-booster` and the version `0.1.0`. Copy `LICENSE` to `plugin/LICENSE`. [REQ-SKILL-003] Verify: `grep -q "^hosts: " docs/spike/README.md && node -e "const fs=require('fs');for(const f of ['plugin/plugin.json','plugin/.claude-plugin/plugin.json']){if(fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,'utf8')).name!=='prompt-booster')process.exit(1)}process.exit(fs.existsSync('plugin/plugin.json')||fs.existsSync('plugin/.claude-plugin/plugin.json')?0:1)" && cmp -s LICENSE plugin/LICENSE`
- [ ] 1.2 Write `scripts/check-plugin.mjs`: the allow list of the folder, the flag `disable-model-invocation: true`, 600 words at most, and no exclamation mark followed by a backtick. Add a `--self-test` flag that proves the three failing cases on a temporary folder. Add the script to `.github/workflows/ci.yml`. [REQ-SKILL-001, REQ-SKILL-009] Verify: `node scripts/check-plugin.mjs --self-test && grep -q "check-plugin" .github/workflows/ci.yml`
- [ ] 1.3 Write `plugin/skills/boost/SKILL.md` by hand with the output contract of REQ-SKILL-002 and the tool rules of REQ-SKILL-010. End it with the date and the `OPTIMIZER_PROMPT_VERSION`. [REQ-SKILL-002, REQ-SKILL-010, REQ-SKILL-009] Verify: `node scripts/check-plugin.mjs && node -e "const s=require('fs').readFileSync('plugin/skills/boost/SKILL.md','utf8').toLowerCase();process.exit(['acceptance','tools','five','data','fewer than three','ok','optimizer_prompt_version'].every(w=>s.includes(w))?0:1)"`
- [ ] 1.4 Write `plugin/README.md`: what the skill does, the install command and the invocation name for each spike host, what it does not do (no script, no hook, no server, no telemetry), the known limit on tool visibility, and the `boost-prompt` skill of `github/awesome-copilot` with the difference. Keep `plugin/` out of a VSIX build in `.vscodeignore`. [REQ-SKILL-001, REQ-SKILL-003] Verify: `grep -q "awesome-copilot" plugin/README.md && grep -qi "no telemetry" plugin/README.md && grep -q "^plugin" .vscodeignore && node scripts/check-plugin.mjs`

## 2. Hosts

- [ ] 2.1 (owner) Run the validator that `docs/spike/01-install.md` names on `plugin/` and record the command and its output in `docs/install-matrix.md`. [REQ-SKILL-003] Verify: `grep -q "^validator: " docs/install-matrix.md && grep -Eq "^validator-result: pass$" docs/install-matrix.md`
- [ ] 2.2 (owner) Install the plugin on each host of the spike `hosts:` line and run the skill one time with a real request. Add one row per host to `docs/install-matrix.md`. [REQ-SKILL-003, REQ-SKILL-002] Verify: `for h in $(sed -n 's/^hosts: //p' docs/spike/README.md | tr ',' ' '); do grep -Eq "^\| $h \|.*\| (pass|fail) \|" docs/install-matrix.md || exit 1; done; grep -q "^hosts: " docs/spike/README.md`
- [ ] 2.3 Run the gate. [REQ-SKILL-001] Verify: `node scripts/check-plugin.mjs && npm run compile && npm run lint && npx -y spec-ctx@0.6.0 check --strict && npx -y @fission-ai/openspec@2.1.0 validate --all --strict --no-interactive`

## Workflow follow-up

- Archive with `openspec archive 003-boost-skill-plugin -y`, then run `specctx build`.
