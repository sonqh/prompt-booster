# Parked designs

These two designs are complete OpenSpec changes that are not scheduled. `decisions/ADR-003-roadmap-to-first-release.md` parked them on 2026-11-18. They sit outside `openspec/changes/`, so `specctx` and `openspec validate` do not read them, and no task of theirs is open.

| Folder | Was | Reopen when |
| --- | --- | --- |
| `host-neutral-core/` | change `003-host-neutral-core` | a second code host is approved |
| `claude-code-boost-plugin/` | change `004-claude-code-boost-plugin` | the `/boost` skill probe (change `005-boost-skill-probe`) beats the 30-day installs or stars of the extension |

Rules:

- The capability codes CORE and PLUG stay reserved in `spec-ctx.toml`. The IDs `REQ-CORE-001` to `REQ-CORE-006` and `REQ-PLUG-001` to `REQ-PLUG-013` are in use by these files. Do not give them to another requirement.
- The text of these files names the old change numbers 003 and 004. Those numbers now belong to other changes.
- To reopen a design, move its folder back under `openspec/changes/` with a new number, update the proposal and the design to the state of the code, and run `specctx build` and `openspec validate --all --strict`.
- Before the plugin design is reopened: change its rule "no change to core", check its section 2 facts again, and settle the heredoc question of its section 4.
