# Tasks

## 1. Golden set

- [ ] 1.1 Write `src/test/fixtures/mcp-golden-prompts.json` with a catalog and at least 20 prompts. At least 5 prompts have an empty `expectedTools` list. [REQ-INJ-007] Verify: `node -e "const g=require('./src/test/fixtures/mcp-golden-prompts.json');process.exit(g.catalog.length>0&&g.prompts.length>=20&&g.prompts.filter(p=>p.expectedTools.length===0).length>=5?0:1)"`
- [ ] 1.2 Write `src/test/core/McpGoldenSet.test.ts`. It imports only `classifyTools` and the fixture, computes precision and recall, and asserts the two limits. Tag it `Covers: REQ-INJ-007` with the three scenario IDs. [REQ-INJ-007] Verify: `npm run compile && npx mocha --ui tdd out/test/core/McpGoldenSet.test.js`

## 2. Background probe

- [ ] 2.1 Add `McpBackgroundProber` in `src/core/services/` with its DI symbol and factory. Move the probe loop out of `RefreshMcpIndexCommand` and call the service there. Add `src/test/core/McpBackgroundProber.test.ts` for the setting on, the setting off, the cap of 10, and the single active run. [REQ-PROBE-001] Verify: `test -f src/test/core/McpBackgroundProber.test.ts && grep -q "McpBackgroundProber" src/presentation/commands/RefreshMcpIndexCommand.ts && npm test`
- [ ] 2.2 In `src/extension.ts`, start a run after the catalog warm-up and on a config watcher event with a 2 second debounce. Do not wait for the run. [REQ-PROBE-001] Verify: `grep -q "McpBackgroundProber" src/extension.ts && grep -q "McpBackgroundProber" src/di/ServiceRegistry.ts && npm run compile && npm run lint`

## 3. Secret fields

- [ ] 3.1 In `MCPToolRegistry`, copy only the five allowed fields of a server config, and hash the settings part of the fingerprint. [REQ-PROBE-007] Verify: `! grep -q "config: cfg," src/core/services/MCPToolRegistry.ts && grep -q "createHash" src/core/services/MCPToolRegistry.ts && npm run compile`
- [ ] 3.2 Add `src/test/core/McpSecretHygiene.test.ts` for the three scenarios of REQ-PROBE-007. [REQ-PROBE-007] Verify: `grep -q "SCN-PROBE-007-1" src/test/core/McpSecretHygiene.test.ts && npm test`

## 4. Command tests

- [ ] 4.1 Add `src/test/presentation/UsePromptVersionCommand.test.ts`: a tagged file finalizes the record and opens the chat; a failing log does not stop the send. [REQ-FILE-005] Verify: `grep -q "Covers: REQ-FILE-005" src/test/presentation/UsePromptVersionCommand.test.ts && npm test`
- [ ] 4.2 Add `src/test/presentation/ShowFeedbackReportCommand.test.ts`: the output holds the funnel, the two rates, and the cache hit rate. [REQ-FBK-005] Verify: `grep -q "Covers: REQ-FBK-005" src/test/presentation/ShowFeedbackReportCommand.test.ts && npm test`
- [ ] 4.3 Add `src/test/presentation/ExportMcpGoldenCandidatesCommand.test.ts`: no candidate writes nothing; a cancel writes nothing; a pick writes the JSON. [REQ-FBK-011] Verify: `grep -q "Covers: REQ-FBK-011" src/test/presentation/ExportMcpGoldenCandidatesCommand.test.ts && npm test`
- [ ] 4.4 Add `src/test/presentation/RefreshMcpIndexCommand.test.ts`: a manual entry survives; the setting off starts no probe. [REQ-DISC-011] Verify: `grep -q "Covers: REQ-DISC-011" src/test/presentation/RefreshMcpIndexCommand.test.ts && npm test`
- [ ] 4.5 Remove the closed debt from the baseline and run the gate. [REQ-INJ-007] Verify: `npx -y spec-ctx@0.6.0 baseline prune && npm run compile && npm run lint && npx -y spec-ctx@0.6.0 check --strict`

## Workflow follow-up

- Archive with `openspec archive 002-mcp-v2-closeout -y`, then run `specctx build`.
