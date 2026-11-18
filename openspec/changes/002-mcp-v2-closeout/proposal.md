# Proposal

## Why

The plan `docs/plans/mcp-aware-tool-provisioning-v2.md` is implemented except for four items. The audit of 2026-11-18 found them:

- Success criterion 2 asks for a golden set of about 20 labeled prompts that gates precision at 0.8. The fixture and the test do not exist, so nothing in CI guards the scorer.
- Section 3 says that the opt-in probe runs in the background on activation and on a config change. Today it runs only from the `Refresh MCP Tool Index` command. The setting description in `package.json` already promises the background run.
- The registry keeps the full raw config of each server in memory, with `env`, `headers`, and unknown keys. The catalog fingerprint holds the VS Code `mcp.servers` setting as raw JSON, with its `env` values. That fingerprint is stored in every feedback record in workspace state.
- The Phase E commands (`Use This Version`, the feedback report, the golden-set export) and the refresh command have no test. The plan accepted manual QA, and no QA record exists.

## What Changes

- Add `src/test/fixtures/mcp-golden-prompts.json` and `src/test/core/McpGoldenSet.test.ts`. The test fails when precision is under 0.8 or recall is under 0.6.
- Add a background probe run on activation and on an MCP config change, only when `promptBooster.mcp.probeServers` is on.
- Keep only the needed fields of a server config. Build the fingerprint from a hash of the settings. Add a test that no `env` or `headers` value reaches a descriptor, the manual index, the fingerprint, or a log.
- Add tests for the four untested commands.

Out of scope: the latency benchmark of criterion 5, support for `url` servers (http and sse), the removal of `vscode` from core (change 003).

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `mcp-tool-injection`: adds the golden-set gate.
- `mcp-probe-security`: changes when the probe can run, and adds the rule for secret fields.

## Impact

- New: `src/test/fixtures/mcp-golden-prompts.json`, `src/test/core/McpGoldenSet.test.ts`, `src/core/services/McpBackgroundProber.ts`, `src/test/core/McpBackgroundProber.test.ts`, `src/test/core/McpSecretHygiene.test.ts`, `src/test/presentation/*.test.ts`.
- Changed: `src/core/services/MCPToolRegistry.ts`, `src/presentation/commands/RefreshMcpIndexCommand.ts`, `src/extension.ts`, `src/di/ServiceRegistry.ts`, `src/di/types.ts`.
- The response cache key changes one time, because the fingerprint format changes. Old cache entries become misses.
