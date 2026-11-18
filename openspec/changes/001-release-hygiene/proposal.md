# Proposal

## Why

The audit of 2026-11-18 found that version 0.2.4 is not ready for a public release. Two palette commands have no handler and fail with "command not found". One setting is never read. The code and the manifest name different default models. The LICENSE file has two lines and no MIT grant. The CHANGELOG stops at 0.2.2. The VSIX ships agent and planning files. No CI runs. The README claims behavior that the code does not have. A user who picks "Never" in the permission dialog has no way back. On an optimizer timeout the chat says "Falling back to original prompt" and then offers nothing.

## What Changes

- Remove the dead commands `promptBooster.testFileGeneration` and `promptBooster.testRealtimeMode` from the manifest and the README.
- Remove the setting `promptBooster.showPreview` and its reader `isShowPreviewEnabled`.
- Use one default for `modelPreference`: `claude-haiku-4.5`, the manifest value that users get today.
- `promptBooster.configurePermissions` can reset the stored permission decision.
- On an optimizer timeout or failure, the chat shows the original prompt with a `Use Original` button.
- LICENSE holds the full MIT text. CHANGELOG gains 0.2.3 and 0.2.4.
- `.vscodeignore` keeps agent, planning, and spec files out of the VSIX. `@vscode/vsce` becomes a dev dependency, so `npm run package` works after `npm ci`.
- A CI workflow runs compile, lint, and the tests under xvfb.
- The README stops the claims "automatic interception" and "core never imports vscode".

Out of scope: a PNG icon and Marketplace publication (owner question), `npm audit` fixes, operation-mode dispatch (owner question), a version bump.

## Capabilities

### New Capabilities
- `release-and-packaging`: the license, changelog, package content, CI, and README truth rules.

### Modified Capabilities
- `extension-settings-and-commands`: adds the rules for declared commands, declared settings, the model default, and the permission reset.
- `chat-participant-realtime-mode`: changes what the chat shows on a timeout or failure.

## Impact

- `package.json` (commands, settings, dev dependency; not the version), `README.md`, `LICENSE`, `CHANGELOG.md`, `.vscodeignore`, `.github/workflows/ci.yml`.
- `src/shared/interfaces/IConfigurationManager.ts`, `src/infrastructure/config/ConfigurationManager.ts`, `src/test/mocks/MockServices.ts`, `src/presentation/commands/CommandRegistry.ts`, `src/core/strategies/RealtimeModeStrategy.ts`, `src/test/core/strategies/RealtimeModeStrategy.test.ts`.
