# chat-participant-realtime-mode Specification

## Purpose
How the `@PromptBooster` chat participant runs an enhancement and shows the result. It covers the run gates, the interactive response with its buttons, and the commands that the buttons call. Enhancement runs only when the user addresses the participant.

## Requirements

### Requirement: REQ-CHAT-001 Chat participant registration
The extension SHALL register one chat participant with the id `promptBooster.interceptor` on activation. The participant handler SHALL be the only caller of `RealtimeModeStrategy.execute`. A failure to register SHALL be logged and SHALL not fail activation. An error in a chat request SHALL be printed to the chat stream as an error line.

#### Scenario: SCN-CHAT-001-1 The chat API is missing
- **WHEN** `vscode.chat.createChatParticipant` throws during activation
- **THEN** the logger records `Failed to register chat participant` and the other commands stay registered

### Requirement: REQ-CHAT-002 Run gate
The participant SHALL run the strategy when `simplifiedContextMode` is on. With `simplifiedContextMode` off it SHALL run only when `operationMode` is `realtime` and `autoOptimize` is on. In every other case it SHALL print a notice and call no model. `RealtimeModeStrategy.execute` SHALL repeat the `autoOptimize` check when `simplifiedContextMode` is off.

#### Scenario: SCN-CHAT-002-1 Auto-optimize is off
- **WHEN** `simplifiedContextMode` is off, `autoOptimize` is off, and the strategy runs
- **THEN** the stream holds `Auto-optimization is disabled` and the optimizer is not called

#### Scenario: SCN-CHAT-002-2 The mode check
- **WHEN** `canHandle` runs with `simplifiedContextMode` off
- **THEN** it returns true for `realtime` and false for `manual` and `file`

### Requirement: REQ-CHAT-003 Permission gate
`RealtimeModeStrategy` SHALL call `hasPermission` before it selects a model. With no stored decision, `hasPermission` SHALL show a modal dialog with `Allow`, `Not Now`, and `Never`. `Allow` SHALL store `permissionGranted = true` in global state. `Never` SHALL store `false`. `Not Now` SHALL store nothing. Without permission the strategy SHALL print `Permission required to optimize prompts` and call no model.

#### Scenario: SCN-CHAT-003-1 Permission is granted
- **WHEN** `autoOptimize` is on and permission is granted
- **THEN** the strategy calls the optimizer and the stream holds `**Optimized Prompt**`

#### Scenario: SCN-CHAT-003-2 The user picks Never
- **WHEN** the user picks `Never` in the dialog
- **THEN** global state holds `permissionGranted = false` and later requests print the permission notice with no dialog

### Requirement: REQ-CHAT-004 No language model
When `getModelAutomatically` returns no model, the strategy SHALL print `No language model available. Please ensure GitHub Copilot is active.` and SHALL not call the optimizer.

#### Scenario: SCN-CHAT-004-1 Copilot is not active
- **WHEN** the model provider returns no model
- **THEN** the stream holds `No language model available` and no button is shown

### Requirement: REQ-CHAT-005 Interactive response
On success the strategy SHALL print `**Optimized Prompt**`, the detected intent, the built-in tool tags, the MCP tool tags, and the enhanced prompt as a quote. For intent `edit` it SHALL show `Apply to Chat` and `Refine in File`. For intent `ask` it SHALL show `Ask in Chat` and `Edit`. It SHALL always show `Use Original`. The first and last buttons SHALL call `promptBooster.runPrompt`. The middle button SHALL call `promptBooster.createPromptFile`.

Refs: REQ-FBK-001

#### Scenario: SCN-CHAT-005-1 Buttons carry the feedback id
- **WHEN** feedback capture is on and an enhancement renders
- **THEN** the accept button has the arguments `[optimized, feedbackId, "accept"]` and `Use Original` has `[original, feedbackId, "reject"]`

#### Scenario: SCN-CHAT-005-2 Feedback capture is off
- **WHEN** `feedback.enabled` is false and an enhancement renders
- **THEN** each button has only its text arguments and no feedback id

### Requirement: REQ-CHAT-006 Timeout, failure, and cancellation
The strategy SHALL race the optimizer call against a 20 second timer. On a timeout or an optimizer error it SHALL log the error and print `Optimization timed out or failed. Falling back to original prompt.` It SHALL show no button in that case. When the cancellation token is set after the call, it SHALL print `Optimization cancelled.` and render nothing else.

#### Scenario: SCN-CHAT-006-1 The optimizer throws
- **WHEN** the optimizer rejects
- **THEN** the stream holds the fallback notice and no button, and the handler does not throw

### Requirement: REQ-CHAT-007 Chat button commands
`promptBooster.runPrompt` SHALL copy the prompt to the clipboard and run `workbench.action.chat.open` with the prompt as the query. When that command returns a falsy value, it SHALL tell the user that the prompt is on the clipboard. `promptBooster.createPromptFile` SHALL write a prompt file through `FileModeStrategy.generatePromptFile` and open it. Both commands SHALL work without a feedback id. Both SHALL show an error message on failure.

Refs: REQ-FILE-001, REQ-FBK-002

#### Scenario: SCN-CHAT-007-1 Run with a feedback id
- **WHEN** `runPrompt` runs with `(text, id, "accept")`
- **THEN** the feedback record `id` resolves to `accept`, the clipboard holds `text`, and the chat opens with `text`

#### Scenario: SCN-CHAT-007-2 Run without a feedback id
- **WHEN** `runPrompt` runs with `(text)` only
- **THEN** no feedback record changes and the chat opens with `text`
