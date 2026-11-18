# Design

## Context

- `ChatParticipantHandler.handleChatRequest` computes `shouldRun` from three settings. `RealtimeModeStrategy.execute` repeats the `autoOptimize` check when `simplifiedContextMode` is off.
- `StatusBarController.updateStatusBar` runs one time, in the constructor. With `simplifiedContextMode` on it shows `$(rocket) PromptBooster` with no command.
- `PromptFileCodeLensProvider` shows the Process lens only when `operationMode` is `file`. The manifest has the same condition on the title button.
- `ProcessButton`, the status bar class in the same file, is exported and never created.
- `FileModeStrategy.generatePromptFile` and `processPromptFile` are in use. `execute` is not.
- The three strategy test files each hold a `canHandle` test. `RealtimeModeStrategy.test.ts` holds a test for the auto-optimize notice.
- Change 001 adds `scripts/check-release.mjs` with the rules `commands` and `settings`, which the manifest fails today.

## Goals / Non-Goals

**Goals:**
- Every setting and command in the manifest does something.
- The four working entry points behave as before for a user on default settings.
- The release check keeps the surface true from now on.

**Non-Goals:**
- A new way to create a prompt file from chat input.
- A rename of the strategy classes.
- An edit of the legacy files under `docs/`. ADR-001 freezes them.

## Decisions

- Remove `autoOptimize`, `toggleAutoOptimization`, and `simplifiedContextMode` with `operationMode`. The alternative, to keep them, leaves one setting that does nothing and one that turns the participant off. Refs: REQ-CHAT-008, REQ-CFG-008
- The participant handler calls the strategy for every request. The permission gate and the model gate stay. A user who wants no enhancement does not type `@PromptBooster`, or picks `Revoke` in `configurePermissions`. Refs: REQ-CHAT-008, REQ-CHAT-003
- Keep the `IModeStrategy` interface with `execute` only, and keep the three class names. A rename would touch every import and every code tag for no user value. Refs: REQ-BOOST-002
- Delete `FileModeStrategy.execute`. `generatePromptFile` stays the one writer of prompt files, and `ChatCommandsHandler.createPromptFile` stays its one caller. Refs: REQ-FILE-006
- Show the Process code lens and the title button for every `.prompt.md` file. The alternative, a new setting to hide them, is the kind of setting that this change removes. Refs: REQ-FILE-007
- Delete the `ProcessButton` status bar class. It never ran, and the code lens and the title button already give the same action. The recut listed a status bar entry for Process. A third entry point for one command adds nothing. Refs: REQ-FILE-007
- The status bar item always reads `$(rocket) PromptBooster` and has no command. This is what a user on default settings sees today. Refs: REQ-CFG-004
- CI calls `node scripts/check-release.mjs --all` from this change on. Refs: REQ-CFG-007, REQ-CFG-008, REQ-REL-007
- OpenSpec 2.1.0 refuses a MODIFIED block that drops or retitles a scenario. So the run gate and the file-mode rule, whose meaning turns around, are removed and added again under new IDs (REQ-CHAT-008, REQ-FILE-007). Requirements that keep their meaning stay MODIFIED and keep their scenario titles. The four removed IDs are retired after the archive with `specctx id retire` and are never used again. Refs: ADR-001

## Risks / Trade-offs

- A user relies on `autoOptimize = false` with `simplifiedContextMode = false` to keep the participant quiet. Mitigation: the CHANGELOG names `Revoke` as the replacement, and the participant only ever ran on `@PromptBooster`.
- A user in file mode loses nothing, and a user in another mode gains a code lens on prompt files. Mitigation: the CHANGELOG says so.
- The removal touches most presentation files, and a code tag can be lost. Mitigation: `specctx check --strict` in the last task.
