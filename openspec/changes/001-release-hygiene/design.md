# Design

## Context

Every item here is small and has no dependency on another change. The audit evidence is in the code at commit f396a0c:

- `package.json` declares `testFileGeneration` and `testRealtimeMode`. No file under `src/` registers them.
- `isShowPreviewEnabled` exists in `ConfigurationManager` and in the mock. No product code calls it.
- `ConfigurationManager.getModelPreference` falls back to `gpt-4.1`. The manifest default is `claude-haiku-4.5`. VS Code returns the manifest default, so the code fallback never applies.
- `configurePermissions` opens the Settings UI. The decision is in global state under `permissionGranted`, which the Settings UI does not show.
- `RealtimeModeStrategy.execute` catches the timeout and prints one line. It renders no button.
- `npm run package` calls `vsce`, which is not in `devDependencies`.

## Goals / Non-Goals

**Goals:**
- No palette entry fails. No declared setting is dead.
- A user can undo "Never".
- A failed optimization still gives the user a one-click way to send the original prompt.
- The repository can be packaged and checked by CI from a clean clone.

**Non-Goals:**
- A version bump or a Marketplace release.
- New self-test commands.
- A change to operation-mode behavior.

## Decisions

- Delete the two test commands. The alternative is to implement real self-test commands. No design asks for them, and the unit tests cover the same paths. Refs: REQ-CFG-007
- Delete `showPreview`. The alternative is to implement a preview switch. The chat response is always a preview with buttons, so the setting has no meaning today. Refs: REQ-CFG-008
- Keep `claude-haiku-4.5` as the one model default and change the code fallback to match. The manifest value is what users get today, so behavior does not change. Refs: REQ-CFG-009
- `configurePermissions` shows a quick pick with `Reset permission decision` and `Open settings`. Reset writes `undefined` to `permissionGranted` through a new `resetPermission()` on `IConfigurationManager`. The next chat request shows the dialog again. The alternative is a boolean setting, which would duplicate the stored decision. Refs: REQ-CFG-010
- On a timeout or failure the strategy prints the notice, quotes the original prompt, and shows one `Use Original` button that calls `promptBooster.runPrompt` with the original prompt. A chat participant cannot send a prompt to another participant without a user action, so a button is the nearest thing to "forward". No feedback record exists at that point, so the button carries no feedback id. Refs: REQ-CHAT-006
- The CI workflow has one job on `ubuntu-latest` with Node 22: `npm ci`, `npm run compile`, `npm run lint`, `xvfb-run -a npm test`. It runs on push and on pull request. Refs: REQ-REL-004
- `.vscodeignore` lists each agent and planning path by name. The check reads the output of `vsce ls`, so it tests the real package content. Refs: REQ-REL-003

## Risks / Trade-offs

- A user script can call a removed command. Mitigation: both commands fail today, so no working flow breaks.
- `xvfb-run -a npm test` downloads VS Code 1.109.0 on each run. Mitigation: cache `.vscode-test` in the workflow.
- The README loses the layering claim until change `003-host-neutral-core` lands. Mitigation: that change has a task to put the line back.
