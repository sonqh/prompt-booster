# Proposal

## Why

The audit of 2026-11-18 found that version 0.2.4 is not ready for a public release, and nothing checks it. No CI runs. The LICENSE file has two lines and no MIT grant. The CHANGELOG stops at 0.2.2. The VSIX ships agent and planning files. `npm run package` calls `vsce`, which is not installed by `npm ci`. Two alpha packages are runtime dependencies, and no file under `src` imports them. The code and the manifest name different default models. The README, the manifest, and the permission dialog claim that prompts are intercepted. A user who picks "Never" in the permission dialog has no way back. On an optimizer timeout the chat says "Falling back to original prompt" and then offers nothing.

This change is the first step of the roadmap in ADR-003. It makes every claim and every file in the package true, and it adds the CI that keeps them true.

## What Changes

- A CI workflow runs compile, lint, the tests, the release checks, and a package build on each push and pull request. This comes first, so the later tasks run under it.
- A script `scripts/check-release.mjs` holds the release rules: declared commands have handlers, declared settings are read, the version matches the CHANGELOG, the README holds no forbidden phrase, the VSIX holds runtime files only, and the model default is one value.
- `@vscode/vsce` becomes a dev dependency. `@vscode/chat-extension-utils` and `@vscode/prompt-tsx` are removed. `npm audit --omit=dev` shows no high advisory.
- LICENSE holds the full MIT text. CHANGELOG gains 0.2.3 and 0.2.4. `.vscodeignore` keeps internal files out of the VSIX.
- The README, the chat participant description, and the permission dialog say that enhancement runs when the user types `@PromptBooster`.
- One default for `modelPreference`: `claude-haiku-4.5`.
- `promptBooster.configurePermissions` can allow, revoke, and reset the permission decision.
- On an optimizer timeout or failure, the chat offers the original prompt with a `Use Original` button.

Out of scope: the removal of the dead commands and settings (change `003-retire-operation-modes` owns it, because it needs the owner), the icon and the store listing (change `004-marketplace-launch`), a version bump.

## Capabilities

### New Capabilities
- `release-and-packaging`: the license, changelog, package content, dependency, CI, and text truth rules.

### Modified Capabilities
- `extension-settings-and-commands`: adds the one model default and the permission controls.
- `chat-participant-realtime-mode`: changes what the chat shows on a timeout or failure.

## Impact

- New: `.github/workflows/ci.yml`, `scripts/check-release.mjs`, `scripts/test-headless.mjs`, `src/test/infrastructure/ConfigurationManager.test.ts`.
- Changed: `package.json` (scripts, dependencies, the participant description; not the version), `package-lock.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, `.vscodeignore`.
- Changed code: `IConfigurationManager.ts`, `ConfigurationManager.ts`, `MockServices.ts`, `CommandRegistry.ts`, `RealtimeModeStrategy.ts` and its test.
