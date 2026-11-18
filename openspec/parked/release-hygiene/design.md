# Design

## Context

Facts from the code at commit f396a0c:

- `.github/` holds only agent definitions. No workflow exists.
- `package.json` lists `@vscode/chat-extension-utils` and `@vscode/prompt-tsx` under `dependencies`. No file under `src` imports them.
- The `package` script calls `vsce`. `vsce` is not in `devDependencies`.
- `ConfigurationManager.getModelPreference` falls back to `gpt-4.1`. The manifest default is `claude-haiku-4.5`. VS Code returns the manifest default, so the code fallback never applies.
- `ConfigurationManager.requestPermission` shows a text that promises "Intercept chat prompts" and "Show preview before submitting". The text holds the four characters `\\n` in place of line breaks.
- `configurePermissions` opens the Settings UI. The decision is in global state under `permissionGranted`, which the Settings UI does not show.
- `RealtimeModeStrategy.execute` catches the timeout and prints one line. It renders no button.
- `npm test` needs a display. On Linux with no display it fails.
- The manifest still declares two commands with no handler and settings that no code reads. Change 003 removes them.

## Goals / Non-Goals

**Goals:**
- A pull request that breaks a release rule fails CI.
- The package can be built from a clean clone with `npm ci`.
- A user can undo "Never".
- A failed optimization still gives the user a one-click way to send the original prompt.

**Non-Goals:**
- A version bump or a store release.
- The removal of commands or settings.
- Fixes for advisories in dev tools.

## Decisions

- CI comes first. One job on `ubuntu-latest` with Node 22 runs `npm ci`, `npm run compile`, `npm run lint`, `npm run test:headless`, `node scripts/check-release.mjs`, and `npm run package`. It runs on push and on pull request and caches `.vscode-test`. Refs: REQ-REL-004
- Add `scripts/test-headless.mjs` and the script `test:headless`. On Linux with no `DISPLAY` it runs `xvfb-run -a npm test`. In every other case it runs `npm test`. Each `Verify:` line that needs the Electron suite calls `npm run test:headless`, so the same line works on a laptop and in CI. Refs: REQ-REL-004
- `scripts/check-release.mjs` has one function per rule and the flags `--list`, `--rule <name>`, and `--all`. The rules are `commands`, `settings`, `changelog`, `readme`, `vsix`, and `model-default`. With no flag it runs the rules in the `blocking` list at the top of the file. In this change that list leaves out `commands` and `settings`, because the manifest breaks them until change 003. Change 003 removes the dead entries and switches CI to `--all`. The alternative, to remove the dead entries here, would split one user-visible removal over two changes. Refs: REQ-REL-007, REQ-CFG-007, REQ-CFG-008
- The `vsix` rule reads `vsce ls` and allows only `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, the icon file, and `out/**/*.js`. An allow list catches a new internal folder with no edit to the rule. A deny list would not. Refs: REQ-REL-003
- The `changelog` rule takes the first `## [x.y.z]` heading and ignores `## [Unreleased]`. Refs: REQ-REL-002
- Remove the two alpha packages and run `npm audit fix` for what is left. `node_modules` never ships, so this changes no shipped byte. It removes the advisories from the production tree. Refs: REQ-REL-006
- Keep `claude-haiku-4.5` as the one model default and change the code fallback to match. The manifest value is what users get today, so behavior does not change. Refs: REQ-CFG-009
- `configurePermissions` shows a quick pick with `Allow`, `Revoke`, and `Reset (ask again)`. It calls the new `setPermission(granted)` and `resetPermission()` on `IConfigurationManager`. No new DI symbol. The alternative is a boolean setting, which would duplicate the stored decision. Refs: REQ-CFG-010
- On a timeout or failure the strategy prints the notice, quotes the original prompt, and shows one `Use Original` button that calls `promptBooster.runPrompt` with the original prompt. The Chat API cannot send a prompt to another participant without a user action, so the participant offers the prompt and does not forward it. No feedback record exists at that point, so the button carries no feedback id. Refs: REQ-CHAT-006
- The permission dialog text names what the extension does: it runs when the user types `@PromptBooster`, it sends the prompt and workspace context to the chosen Copilot model, and it shows the result with buttons. It uses real line breaks. Refs: REQ-REL-005

## Risks / Trade-offs

- `npm run test:headless` downloads VS Code 1.109.0. Mitigation: the workflow caches `.vscode-test`.
- `npm audit fix` can move a dev tool to a new major version. Mitigation: the task runs compile, lint, and the tests after it, and `--force` is not used.
- The README loses the layering claim. Mitigation: the claim is false today, and the parked design `openspec/parked/host-neutral-core` says when it can come back.
- CI is green in this change while two dead commands stay in the manifest. Mitigation: change 003 switches CI to `--all`, and the launch change 004 runs `--all` before the release.
