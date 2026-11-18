# Proposal

## Why

The plan `docs/plans/mcp-aware-tool-provisioning-v2.md` is implemented, but the audit of 2026-11-18 and the review after it found gaps in proof, in secrets, and in trust:

- Success criterion 2 asks for a golden set that gates precision at 0.8. The fixture and the test do not exist, so nothing in CI guards the scorer. The launch claim "the right MCP tools" has no evidence.
- `MCPToolRegistry.computeFingerprint` returns a plain join of its inputs. One input is the VS Code `mcp.servers` setting as raw JSON, with its `env` and `headers` values. Every feedback record stores that string in workspace state.
- The registry keeps the full raw config of each server in memory, with `headers` and unknown keys.
- A cloned repository can hold `.vscode/mcp.json` and `.vscode/settings.json`. Today the extension reads both in an untrusted workspace, and a workspace setting can turn `promptBooster.mcp.probeServers` on. The probe starts the commands that the workspace file names.
- The setting description says that the probe runs "on activation, config change, or via the command". Only the command exists. The background probe is cut from the roadmap (ADR-003), so the text must change and not the code.
- The Phase E commands and the refresh command have no test.

## What Changes

- Add a golden set of at least 20 labeled prompts over at least 20 tools, and a test that fails under 0.8 precision or under 0.6 recall. CI runs it.
- Hash the catalog fingerprint with SHA-256. Keep `env` and `headers` values out of the hashed input, out of the registry state, and out of every stored or written artifact. Add a canary test.
- A server with a `url` is listed by name only. Its `headers` are dropped at parse. The extension never connects to it.
- In an untrusted workspace, read no workspace MCP config and run no probe. Accept `mcp.probeServers` only from user or machine settings.
- Describe the probe as manual-only in the manifest.
- Add tests for the four untested commands.

Out of scope: a background probe (cut), support for http and sse servers, the latency benchmark of criterion 5, the removal of `vscode` from core (parked).

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `mcp-tool-injection`: adds the golden-set gate.
- `mcp-probe-security`: adds the trusted-workspace condition, the rule for secret fields, and the setting scope.
- `mcp-tool-discovery`: adds the rule for `url` servers and the rule for untrusted workspaces.

## Impact

- New: `src/test/fixtures/mcp-golden-prompts.json`, `src/test/core/McpGoldenSet.test.ts`, `src/test/core/McpSecretCanary.test.ts`, `src/test/presentation/commands/*.test.ts`.
- Changed: `MCPToolRegistry.ts`, `IMcpEnvironmentProvider.ts`, `VSCodeMcpEnvironmentProvider.ts`, `VSCodeConfigWatcher.ts`, `RefreshMcpIndexCommand.ts`, `MockMcpEnvironmentProvider.ts`, `MCPToolRegistry.test.ts`, `package.json` (`capabilities`, the scope and description of `mcp.probeServers`).
- The response cache key changes one time, because the fingerprint format changes. Old cache entries become misses.
