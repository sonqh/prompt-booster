# Spec Delta

## REMOVED Requirements

### Requirement: REQ-FILE-004 Process affordances in file mode only
**Reason**: `operationMode` is removed, so no file mode exists. REQ-FILE-007 states the new rule.
**Migration**: Move the code tag from REQ-FILE-004 to REQ-FILE-007. The Process lens and button now show for every `.prompt.md` file.

## MODIFIED Requirements

### Requirement: REQ-FILE-005 Use This Version
The code lens `Use This Version` SHALL appear on a `.prompt.md` file whose leading comment holds a feedback id. `promptBooster.usePromptVersion` SHALL remove the HTML comments, finalize the feedback record with the remaining text, and send that text to the chat with a clipboard fallback. A failure to finalize SHALL be logged and SHALL not stop the send.

Refs: REQ-FBK-002, REQ-FBK-012

#### Scenario: SCN-FILE-005-1 An edited file is used
- **WHEN** the user edits a generated file that holds the feedback id `abc` and clicks `Use This Version`
- **THEN** the record `abc` becomes `edit-finalized` with the edited text, and the chat opens with that text

## ADDED Requirements

### Requirement: REQ-FILE-006 One source of prompt files
The extension SHALL create a prompt file only when the user clicks `Refine in File` or `Edit` in a chat response. `FileModeStrategy` SHALL have no entry point that creates a file from chat input by a mode.

Refs: REQ-FILE-001, REQ-CHAT-007

#### Scenario: SCN-FILE-006-1 The callers
- **WHEN** a reader searches `src/` for calls of `generatePromptFile`
- **THEN** the one product caller is `ChatCommandsHandler.createPromptFile`

### Requirement: REQ-FILE-007 Process affordances
The code lens `Process this prompt with Copilot` SHALL appear on every file whose name ends in `.prompt.md`. The manifest SHALL show the Process button in the editor title bar for the same files. No setting SHALL hide them.

Refs: REQ-FILE-003

#### Scenario: SCN-FILE-007-1 A prompt file
- **WHEN** a `.prompt.md` file with no feedback header is open
- **THEN** the code lens provider returns the Process lens

#### Scenario: SCN-FILE-007-2 Another file type
- **WHEN** `notes.md` is open
- **THEN** the code lens provider returns no lens
