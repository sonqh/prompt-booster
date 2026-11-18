# Design

## Context

- `classifyTools` is a pure function. Its compiled file needs no `vscode` module, so a golden-set test can run in plain mocha with no Electron.
- The probe loop lives inside `RefreshMcpIndexCommand.refresh`, a presentation class. Activation in `src/extension.ts` only calls `ensureCatalog`.
- `MCPToolRegistry.registerServers` stores `config: cfg`, the parsed object as it is. `computeFingerprint` adds `settings:` followed by `stableStringify(getVsCodeServerSettings())`. `RealtimeModeStrategy.captureFeedback` stores `getCatalogFingerprint()` in the feedback record.
- `McpToolIndexStore.saveManualIndex` already writes only `server`, `name`, `description`, and `inputSummary`. Catalog entries already have no `env` field. No test pins either fact.
- `IConfigChangeWatcher` already fires on a change of an MCP config file and of the `mcp` and `promptBooster.mcp` settings.

## Goals / Non-Goals

**Goals:**
- A scorer change that drops precision under 0.8 fails a test.
- The probe behaves as its setting description says.
- No secret value from an MCP config is kept longer than a probe needs it or leaves memory.

**Non-Goals:**
- A change to the scorer rules.
- A probe on the chat request path.
- Tests for the VS Code adapters and for `ChildProcessMcpTransport`.

## Decisions

- The golden fixture has the shape `{ "catalog": [descriptor...], "prompts": [{ "prompt", "expectedTools": [qualifiedName...] }] }` with at least 20 prompts. At least 5 prompts expect no tool, so false positives count. The maintainer writes the first set by hand. Later entries come from `Export MCP Golden-Set Candidates` after review. Refs: REQ-INJ-007, REQ-FBK-011
- Precision is the count of injected tools that are expected, divided by the count of injected tools, over the full set. Recall is the same count divided by the count of expected tools. The test fails under 0.8 precision or under 0.6 recall and prints both numbers. The v2 plan made recall a target only. The lead decided on 2026-11-18 to gate both. Refs: REQ-INJ-007, ADR-002
- Move the probe loop into a core service `McpBackgroundProber` with the method `run(): Promise<number>`. It reads `probeServers`, takes at most 10 targets from `getProbeTargets`, probes them one after the other, writes the probe cache, and returns the count of servers that gave tools. `RefreshMcpIndexCommand` calls the same service, so one code path holds the opt-in check. The alternative, a second loop in `extension.ts`, would copy the check. Refs: REQ-PROBE-001
- Activation calls `prober.run()` after `ensureCatalog` settles, without waiting for it. A config watcher event calls it with a 2 second debounce. One run at a time: an event during a run sets a flag for one more run. After a run that found tools, the registry refreshes. Refs: REQ-PROBE-001, REQ-DISC-007
- `registerServers` copies only `command`, `args`, `env`, `disabled`, and `tools` from a parsed server entry. `env` stays in memory because the probe passes it to the child process. `headers`, `url`, and every other key are dropped at parse time. Refs: REQ-PROBE-007
- The fingerprint part for the settings becomes `settings:<sha256 of the stable JSON>`. The fingerprint still changes when a setting changes, and it holds no setting value. Refs: REQ-PROBE-007, REQ-DISC-008
- Command tests run in the Electron suite and call `execute()` on a command built with mock services. They stub `vscode.commands.executeCommand` and the dialogs for the length of one test. Refs: REQ-FILE-005, REQ-FBK-005, REQ-FBK-011, REQ-DISC-011

## Risks / Trade-offs

- A hand-written golden set can fit the scorer too well. Mitigation: at least 5 negative prompts, and growth from real exported candidates.
- A background probe starts user processes without a click. Mitigation: it needs the opt-in setting, it keeps the time limits, and the probe cache stops a second start of the same server for 24 hours.
- The fingerprint change empties the response cache one time. Mitigation: the cache is an optimization only.
