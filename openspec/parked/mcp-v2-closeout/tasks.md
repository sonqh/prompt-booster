# Tasks

Size: about 5 evenings. This change needs task 1.1 of change `001-release-hygiene` (`npm run test:headless` and CI).

## 1. Golden set

- [ ] 1.1 Write `src/test/fixtures/mcp-golden-prompts.json` with at least 20 tools and at least 20 prompts. At least 3 prompts have an empty `expectedTools` list. Two tool descriptions are adversarial. The owner reviews the labels. Commit the labels before any scorer change. [REQ-INJ-007] Verify: `node -e "const g=require('./src/test/fixtures/mcp-golden-prompts.json');process.exit(g.tools.length>=20&&g.prompts.length>=20&&g.prompts.filter(p=>p.expectedTools.length===0).length>=3?0:1)"`
- [ ] 1.2 Write `src/test/core/McpGoldenSet.test.ts`. It does not import `MockServices`. It computes precision and recall, asserts the two limits, and asserts the adversarial case. Tag it `Covers: REQ-INJ-007` with the four scenario IDs. Change `ToolAffinityClassifier.ts` only if the gate fails. [REQ-INJ-007] Verify: `grep -q "SCN-INJ-007-1" src/test/core/McpGoldenSet.test.ts && npm run compile && npx mocha --ui tdd out/test/core/McpGoldenSet.test.js`

## 2. Secret fields

- [ ] 2.1 In `MCPToolRegistry`, copy only the five allowed fields of a server config. Drop `env` and `headers` keys from the settings part of the fingerprint input, and return the SHA-256 digest. In `PromptFeedbackLog`, replace a stored fingerprint that is not 64 hex characters with the empty string at load. [REQ-PROBE-007] Verify: `! grep -q "config: cfg," src/core/services/MCPToolRegistry.ts && grep -q "createHash" src/core/services/MCPToolRegistry.ts && npm run compile && npm run test:headless`
- [ ] 2.2 Add `src/test/core/McpSecretCanary.test.ts` for the four scenarios of REQ-PROBE-007. It covers the logger, workspace state, the mock file system, the optimizer input, the report command, and the export command. [REQ-PROBE-007] Verify: `grep -q "CANARY-SECRET" src/test/core/McpSecretCanary.test.ts && grep -q "SCN-PROBE-007-2" src/test/core/McpSecretCanary.test.ts && npm run test:headless`

## 3. URL servers

- [ ] 3.1 Add a test named `url server is listed by name only` to `MCPToolRegistry.test.ts` with `Covers: REQ-DISC-012`. Make it pass. [REQ-DISC-012] Verify: `grep -q "url server is listed by name only" src/test/core/MCPToolRegistry.test.ts && ! grep -rnE "from \"(node:)?(https?|net)\"|fetch\(" src/core src/infrastructure && npm run test:headless`

## 4. Workspace trust

- [ ] 4.1 Add `isWorkspaceTrusted()` to `IMcpEnvironmentProvider`, the VS Code adapter, and the mock. In an untrusted workspace, skip the workspace config files and use the user value of `mcp.servers`. Fire the config watcher on a trust grant. Make `RefreshMcpIndexCommand` refuse to probe. Add tests named `untrusted workspace` to `MCPToolRegistry.test.ts` with `Covers: REQ-DISC-013`. [REQ-DISC-013, REQ-PROBE-001] Verify: `grep -q "isWorkspaceTrusted" src/shared/interfaces/IMcpEnvironmentProvider.ts && grep -q "isWorkspaceTrusted" src/presentation/commands/RefreshMcpIndexCommand.ts && grep -q "SCN-DISC-013-1" src/test/core/MCPToolRegistry.test.ts && npm run test:headless`
- [ ] 4.2 In `package.json`, add `capabilities.untrustedWorkspaces`, set `scope: "machine"` on `promptBooster.mcp.probeServers`, and rewrite its description as manual-only. [REQ-PROBE-008, REQ-PROBE-001] Verify: `node -e "const p=require('./package.json'),c=p.capabilities.untrustedWorkspaces,s=p.contributes.configuration.properties['promptBooster.mcp.probeServers'];process.exit(c.supported==='limited'&&c.restrictedConfigurations.includes('promptBooster.mcp.probeServers')&&s.scope==='machine'&&!/activation|config change/i.test(s.description)?0:1)"`

## 5. Command tests

- [ ] 5.1 Add `src/test/presentation/commands/UsePromptVersionCommand.test.ts`: a tagged file finalizes the record and opens the chat; a failing log does not stop the send. [REQ-FILE-005] Verify: `grep -q "Covers: REQ-FILE-005" src/test/presentation/commands/UsePromptVersionCommand.test.ts && npm run test:headless`
- [ ] 5.2 Add `src/test/presentation/commands/ShowFeedbackReportCommand.test.ts`: the output holds the funnel, the two rates, and the cache hit rate. [REQ-FBK-005] Verify: `grep -q "Covers: REQ-FBK-005" src/test/presentation/commands/ShowFeedbackReportCommand.test.ts && npm run test:headless`
- [ ] 5.3 Add `src/test/presentation/commands/ExportMcpGoldenCandidatesCommand.test.ts`: no candidate writes nothing; a cancel writes nothing; a pick writes the JSON. [REQ-FBK-011] Verify: `grep -q "Covers: REQ-FBK-011" src/test/presentation/commands/ExportMcpGoldenCandidatesCommand.test.ts && npm run test:headless`
- [ ] 5.4 Add `src/test/presentation/commands/RefreshMcpIndexCommand.test.ts`: a manual entry survives; the setting off starts no probe; an untrusted workspace starts no probe. Tag the three scenarios of REQ-PROBE-001 and `SCN-DISC-011-1`. [REQ-DISC-011, REQ-PROBE-001] Verify: `grep -q "SCN-PROBE-001-2" src/test/presentation/commands/RefreshMcpIndexCommand.test.ts && grep -q "Covers: REQ-DISC-011" src/test/presentation/commands/RefreshMcpIndexCommand.test.ts && npm run test:headless`
- [ ] 5.5 Remove the closed debt from the baseline and run the gate. [REQ-INJ-007] Verify: `npx -y spec-ctx@0.6.0 baseline prune && npm run compile && npm run lint && npx -y spec-ctx@0.6.0 check --strict`

## Workflow follow-up

- Archive with `openspec archive 002-mcp-v2-closeout -y`, then run `specctx build`.
