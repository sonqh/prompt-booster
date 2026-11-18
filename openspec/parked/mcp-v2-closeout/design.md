# Design

## Context

- `classifyTools` is a pure function. Its compiled file needs no `vscode` module. `npx mocha --ui tdd out/test/core/ToolAffinityClassifier.test.js` passes in plain Node today, so a golden-set test can run with no Electron.
- `registerServers` stores `config: cfg`, the parsed object as it is. A server with no `command` is registered by name and marked disabled, so a `url` server already has no tool and no probe. Its `headers` stay in memory.
- `computeFingerprint` returns `parts.join("|")`. `RealtimeModeStrategy.captureFeedback` stores `getCatalogFingerprint()` in the feedback record. The response cache hashes it into the key.
- No logger line prints the fingerprint. `ExportMcpGoldenCandidatesCommand` writes only `prompt` and `expectedTools`. `ShowFeedbackReportCommand` prints counts and rates. Neither writes the fingerprint today. No test pins that.
- `McpToolIndexStore.saveManualIndex` writes only `server`, `name`, `description`, and `inputSummary`.
- The manifest has no `capabilities` entry, so VS Code treats the extension as fully supported in an untrusted workspace. `promptBooster.mcp.probeServers` has no `scope`.
- The probe is called from one place, `RefreshMcpIndexCommand.refresh`.

## Goals / Non-Goals

**Goals:**
- A scorer change that drops precision under 0.8 or recall under 0.6 fails CI.
- No secret value from an MCP config is stored, written, logged, or sent to the model.
- A repository that the user did not trust cannot make the extension read its MCP config or start a process.

**Non-Goals:**
- A change to the scorer rules, unless the gate fails on honest labels.
- A probe on activation or on a config change.
- A connection to any `url` server.

## Decisions

- The golden fixture has the shape `{ "tools": [descriptor...], "prompts": [{ "id", "prompt", "expectedTools": [qualifiedName...] }] }`. It holds at least 20 prompts and at least 20 tools. At least 3 prompts expect no tool, so false positives count. Two tool descriptions are adversarial: one holds control characters and an instruction, one is 2,000 characters long. The owner writes or reviews the labels, and the labels are committed before any change to the scorer. Refs: REQ-INJ-007, REQ-INJ-004
- Precision is the count of injected tools that are expected, divided by the count of injected tools, over the full set. Recall is the same count divided by the count of expected tools. The test fails under 0.8 precision or under 0.6 recall and prints both numbers. The v2 plan made recall a target only. The roadmap gates both. Refs: REQ-INJ-007, ADR-003
- The golden test imports `classifyTools`, `MCPToolRegistry` (for `formatForSystemPrompt`, built with inline stubs), and the fixture. It does not import `MockServices`, which needs `vscode`. It runs in the Electron suite, which CI runs, and also in plain mocha. Refs: REQ-INJ-007
- `registerServers` copies only `command`, `args`, `env`, `disabled`, and `tools` from a parsed server entry. `env` stays in memory because the probe passes it to the child process. It leaves the registry only through `getProbeTargets`. `headers`, `url`, and every other key are dropped at parse time. Refs: REQ-PROBE-007, REQ-DISC-012
- `getCatalogFingerprint` returns the SHA-256 hex digest of the joined parts. Before the join, the settings part drops each `env` and `headers` key at every depth. The alternative, to hash the raw settings, keeps a secret inside a stored digest that a weak value could be guessed from. A change to an `env` value alone then does not refresh the catalog, which is correct: `env` does not change the tool list. Refs: REQ-PROBE-007, REQ-DISC-008
- One canary test plants the string `CANARY-SECRET` as an `env` value and as a `headers` value in a workspace file and in `mcp.servers`. It runs discovery, a refresh, an enhancement, the report command, and the export command with mock services. It then searches every logger line, every workspace state value, every file that the mock file system holds, and the optimizer input. Refs: REQ-PROBE-007
- Add `isWorkspaceTrusted()` to the existing `IMcpEnvironmentProvider`. No new DI symbol. In an untrusted workspace the registry skips the five workspace config files, the adapter reads `mcp.servers` through `inspect()` and returns the user value only, and the refresh command refuses to probe. `VSCodeConfigWatcher` fires on `onDidGrantWorkspaceTrust`, so the catalog refreshes when trust is granted. Refs: REQ-DISC-013, REQ-PROBE-001
- The manifest declares `capabilities.untrustedWorkspaces` with `supported: "limited"` and lists `promptBooster.mcp.probeServers` under `restrictedConfigurations`. The setting gets `scope: "machine"`, so a workspace settings file cannot set it even in a trusted workspace. A trust gate alone would not stop a clone that the user trusted by habit. Refs: REQ-PROBE-008, REQ-PROBE-001
- Command tests run in the Electron suite and call `execute()` on a command built with mock services. They stub `vscode.commands.executeCommand` and the dialogs for the length of one test. Refs: REQ-FILE-005, REQ-FBK-005, REQ-FBK-011, REQ-DISC-011

## Risks / Trade-offs

- A hand-written golden set can fit the scorer too well. Mitigation: labels come first and are committed first, the set holds negative and adversarial cases, and later entries come from real exported candidates.
- The gate can fail on honest labels. Mitigation: then the scorer changes inside this change, with the labels fixed. The size estimate holds one evening for that.
- The fingerprint change empties the response cache one time. Mitigation: the cache is an optimization only.
- Old feedback records keep the old raw fingerprint in workspace state. Mitigation: the task replaces a stored fingerprint that is not a 64 character hex string with the empty string at load.
- In an untrusted workspace the user sees fewer tools and no notice. Mitigation: the refresh command says why it did not probe.
