# Parked designs

These folders are complete OpenSpec changes with no schedule. `decisions/ADR-004-plugin-first.md` set this state on 2026-11-18, after VS Code deprecated chat participants. The folders sit outside `openspec/changes/`, so `specctx` and `openspec validate` do not read them, and no task of theirs is open.

| Folder | Was | Why parked | Revive when |
| --- | --- | --- | --- |
| `mcp-v2-closeout/` | change `002-mcp-v2-closeout` | It hardens the engine of the frozen extension: the golden set, the fingerprint fix (REQ-PROBE-007), the trust gate, the rule for `url` and `headers` | the engine comes back as a local MCP server, or the extension is unfrozen |
| `retire-operation-modes/` | change `003-retire-operation-modes` | It cleans the surface of an extension that is frozen and never published | the extension is unfrozen |
| `marketplace-launch/` | change `004-marketplace-launch` | The extension is never published to a store. Its headline entry does not run on the Copilot harness | the owner reverses decision 3 of ADR-004 |
| `release-hygiene/` | change `001-release-hygiene` | A copy of the old first change. Its license, changelog, and README parts moved to `001-repo-honesty`. The rest (release check script, VSIX content, dependency audit, model default, permission controls, timeout offer) serves a store release | the extension is unfrozen |
| `host-neutral-core/` | change `003-host-neutral-core` of the first cut | The skill uses no core code, so no second code host needs a core without `vscode` | the engine comes back as a local MCP server. Only its three type lifts are needed then |
| `claude-code-boost-plugin/` | change `004-claude-code-boost-plugin` of the first cut | History. ADR-004 replaces this design (a CLI, three hooks, file stores) with one instruction-only skill | never as it is. Read it for ideas only |

Two parts of `mcp-v2-closeout` were pulled into `001-repo-honesty` in a smaller form: the scope `machine` on `promptBooster.mcp.probeServers`, and a manifest line for untrusted workspaces (`supported: false` in place of the trust gate in code).

Rules:

- The IDs in these files stay reserved. Do not give them to another requirement: `REQ-CORE-001` to `006`, `REQ-PLUG-001` to `013`, `REQ-INJ-007`, `REQ-PROBE-007` and `008`, `REQ-DISC-012` and `013`, `REQ-CFG-007` to `010`, `REQ-CHAT-008`, `REQ-FILE-006` and `007`, `REQ-REL-003`, `006` to `015`. `specctx id new` does not see them. Check this list before you use a new number for CFG, CHAT, FILE, DISC, INJ, PROBE, or REL.
- The capability codes CORE and PLUG stay reserved in `spec-ctx.toml`.
- The text of these files names old change numbers. Those numbers now belong to other changes.
- To revive a design, move its folder back under `openspec/changes/` with a new number, update the proposal and the design to the state of the code, and run `specctx build` and `openspec validate --all --strict`.
