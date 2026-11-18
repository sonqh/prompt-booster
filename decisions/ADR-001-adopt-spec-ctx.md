# ADR-001 Adopt OpenSpec and spec-ctx as the design source of truth

Status: proposed. Date: 2026-11-18.

## Context

The design of PromptBooster lived in loose markdown files under `docs/`, in `implementation_plan.md`, and in `walkthrough.md`. An audit on 2026-11-18 compared these files with the code at commit f396a0c. It found three problems:

- The docs understate the code. Every phase checklist is unchecked, and the work is done.
- The docs overstate the code in other places. Examples are "automatic interception" and "core never imports vscode".
- Two pairs of files are copies of each other, and nothing says which file is current.

## Decision

- The OpenSpec tree under `openspec/` is the design source of truth from this date.
- A main spec under `openspec/specs/<capability>/spec.md` states only behavior that the code implements today. Each requirement was checked against the code before it was written.
- A design that is not finished is an active change under `openspec/changes/`. Its delta spec moves into the main spec at archive.
- Every requirement and scenario has a stable ID. The `spec-ctx` CLI manages the IDs, the links to code and tests, and the task loop.
- The legacy files stay in the repository as history. Nobody edits them. A new design does not go there.
- Code carries a comment `// REQ-<CAP>-NNN` above the class or function that implements a requirement. A test file carries `// Covers: REQ-<CAP>-NNN`.

Capability codes:

| Code | Capability | Main spec today |
| --- | --- | --- |
| ENH | `prompt-enhancement-pipeline` | yes |
| CHAT | `chat-participant-realtime-mode` | yes |
| BOOST | `manual-boost-mode` | yes |
| FILE | `file-prompt-mode` | yes |
| CFG | `extension-settings-and-commands` | yes |
| DISC | `mcp-tool-discovery` | yes |
| INJ | `mcp-tool-injection` | yes |
| PROBE | `mcp-probe-security` | yes |
| FBK | `prompt-feedback-learning` | yes |
| REL | `release-and-packaging` | no, change 001 adds it |
| CORE | `host-neutral-core` | no, change 003 adds it |
| PLUG | `claude-code-boost-plugin` | no, change 004 adds it |

## Legacy document map

| Legacy file | Status | Where the content lives now |
| --- | --- | --- |
| `docs/promptbooster-enhancement-spec.md` | implemented | ENH (Enhancements 1 to 3), DISC and INJ (Enhancement 4), CHAT |
| `docs/promptbooster-intelligent-enhancement.md` | duplicate of the file above, one link differs | same as above |
| `docs/plan-promptbooster-mcp-awareness.md` | superseded by the v2 plan (its own line 3 says so) | DISC, INJ |
| `docs/plans/mcp-aware-tool-provisioning-v2.md` | implemented, except four items | DISC, INJ, PROBE, FBK. Open items: change `002-mcp-v2-closeout`. Criterion 8: change `003-host-neutral-core`. Decisions: ADR-002 |
| `docs/plans/claude-code-plugin-design.md` | approved 2026-09-09, not started | change `004-claude-code-boost-plugin`, with its prerequisite `003-host-neutral-core` |
| `docs/meta-mcp-orchestrator-spec.md` | parked, no code, owner decision open | none. See the open question in `.ctx/questions.json` |
| `docs/meta-mcp-orchestrator.md` | duplicate of the file above, two links differ | none |
| `docs/plan-meta-mcp-orchestrator.md` | parked, no code, owner decision open | none |
| `docs/architecture_diagrams.md` | history of the 0.2.0 refactor | none. The layers are in `AGENTS.md` |
| `implementation_plan.md` | implemented working notes for Enhancements 1 to 4 | ENH, DISC, INJ |
| `walkthrough.md` | implemented working notes, test counts are stale | ENH, DISC, INJ |
| `README.md` | current user document, with four wrong claims | change `001-release-hygiene` corrects the claims |
| `CHANGELOG.md` | current, entries 0.2.3 and 0.2.4 are missing | change `001-release-hygiene` |
| `AGENTS.md` | current agent guide | gains a "Specs and workflow" section |

## Consequences

- `specctx check --strict` reports a main requirement that no test covers. The requirements with no test on 2026-11-18 are in `.ctx/baseline.json`. The baseline can only shrink.
- Operation-mode dispatch and the Meta-MCP orchestrator have no change. Each waits for an owner decision.
- The two duplicate files stay until the owner says which copy to delete.

Refs: ADR-002
