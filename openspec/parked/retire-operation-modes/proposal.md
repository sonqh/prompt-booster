# Proposal

**This change removes settings and commands that users can see. It needs the approval of the owner before a task starts.**

## Why

The extension shows three operation modes (`manual`, `realtime`, `file`), but no code selects a strategy by the mode. The audit of 2026-11-18 found:

- `IModeStrategy.canHandle` is never called by product code.
- `FileModeStrategy.execute`, which would create a prompt file from chat input in file mode, has no caller.
- With `simplifiedContextMode` on, which is the default, chat always enhances and the editor always boosts. `operationMode` then decides only if the Process code lens and title button show.
- `ChatParticipantHandler` runs when `simplifiedContextMode || (operationMode === "realtime" && autoOptimize)`. Once `operationMode` goes, `autoOptimize` and its toggle command do nothing, and `simplifiedContextMode = false` turns the participant off with no notice. So all three must go together.
- `promptBooster.showPreview` is read by no product code.
- `promptBooster.testFileGeneration` and `promptBooster.testRealtimeMode` are in the Command Palette and have no handler.
- The `ProcessButton` status bar class is never created.

A first-time user sees a mode picker and four settings that change nothing. The roadmap in ADR-003 asks for a small, true surface before the first store release.

## What Changes

- **BREAKING** Remove the settings `promptBooster.operationMode`, `promptBooster.simplifiedContextMode`, `promptBooster.autoOptimize`, and `promptBooster.showPreview`.
- **BREAKING** Remove the commands `promptBooster.switchMode`, `promptBooster.toggleAutoOptimization`, `promptBooster.testFileGeneration`, and `promptBooster.testRealtimeMode`.
- Remove the dead code: `OperationMode`, `SwitchModeCommand`, `canHandle`, `FileModeStrategy.execute`, the `ProcessButton` status bar class, and the mode methods of the config service.
- The Process code lens and title button show for every `.prompt.md` file.
- CI runs every release rule, with `commands` and `settings` now blocking.

What stays, with no change: the `@PromptBooster` chat participant, right-click `Boost This Prompt`, `Refine in File`, `Process Prompt File`, `Use This Version`, the model setting, and all MCP, feedback, cache, and learning settings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `extension-settings-and-commands`: removes the mode switch and the auto-optimize toggle, changes the status bar item, and adds the rules for declared commands and settings.
- `chat-participant-realtime-mode`: the participant runs with no mode precondition.
- `manual-boost-mode`: drops the mode check.
- `file-prompt-mode`: Process shows for every prompt file, and prompt files come only from `Refine in File`.

## Impact

- `package.json`: 4 settings, 4 commands, one `when` clause.
- Deleted: `src/shared/types/OperationMode.ts`, `src/presentation/commands/SwitchModeCommand.ts`.
- Changed: `IModeStrategy.ts`, the three strategies, `IConfigurationManager.ts`, `ConfigurationManager.ts`, `CommandRegistry.ts`, `ChatParticipantHandler.ts`, `StatusBarController.ts`, `ProcessButton.ts`, `extension.ts`, `di/types.ts`, `di/ServiceRegistry.ts`, `MockServices.ts`, the strategy tests.
- `README.md`, `AGENTS.md`, `CHANGELOG.md`, `.github/workflows/ci.yml`.
- A user who set one of the four settings sees it as unknown in the settings file. Nothing fails.
