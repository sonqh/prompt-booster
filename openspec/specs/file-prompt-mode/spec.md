# file-prompt-mode Specification

## Purpose
How PromptBooster writes a `.prompt.md` file for manual refinement and sends such a file to Copilot Chat. It covers the file content, the file name, the Process command, and the `Use This Version` code lens.

## Requirements

### Requirement: REQ-FILE-001 Prompt file generation
`FileModeStrategy.generatePromptFile` SHALL write one file under `<workspace>/<fileOutputDirectory>` and create that directory when it is missing. The file SHALL start with an HTML comment that holds the original prompt, the time, and the line `PromptBooster-Feedback-Id: <id>` when an id is given. The optimized prompt SHALL follow, then a comment with instructions. It SHALL return the file path. With no workspace folder it SHALL throw `No workspace folder open`.

Refs: REQ-FBK-012

#### Scenario: SCN-FILE-001-1 A file is written
- **WHEN** `generatePromptFile("original", "optimized")` runs in a workspace
- **THEN** one file exists under the output directory, and its content holds `optimized` and the original prompt inside a comment

### Requirement: REQ-FILE-002 File naming
The file name SHALL follow `fileNamingPattern`. `timestamp` SHALL give `chat-<ISO time>.prompt.md`. `prompt` SHALL give a slug of the first 50 characters of the first line, in lower case, with spaces as dashes. When that name exists, it SHALL add `-2`, `-3`, and so on. `custom` SHALL ask for a name of letters, digits, dashes, and underscores. When the user cancels, no file SHALL be written.

#### Scenario: SCN-FILE-002-1 A name collision
- **WHEN** the pattern is `prompt`, the first line is `Fix the login bug`, and `fix-the-login-bug.prompt.md` exists
- **THEN** the new file is `fix-the-login-bug-2.prompt.md`

#### Scenario: SCN-FILE-002-2 The user cancels a custom name
- **WHEN** the pattern is `custom` and the user closes the input box
- **THEN** `generatePromptFile` returns no path and writes no file

### Requirement: REQ-FILE-003 Process a prompt file
`promptBooster.processPromptFile` SHALL accept only a document whose name ends in `.prompt.md`. It SHALL remove every HTML comment, trim the text, and run `workbench.action.chat.open` with the text as the query. When that command returns a falsy value, it SHALL copy the text to the clipboard. Text that is empty after the comments go SHALL give a warning and send nothing.

#### Scenario: SCN-FILE-003-1 Comments are removed
- **WHEN** the file holds a header comment, the text `Do the task`, and a footer comment
- **THEN** the chat opens with the query `Do the task`

#### Scenario: SCN-FILE-003-2 A file of another type
- **WHEN** the active document is `notes.md`
- **THEN** the command shows `This command only works with .prompt.md files` and sends nothing

### Requirement: REQ-FILE-004 Process affordances in file mode only
The code lens `Process this prompt with Copilot` SHALL appear on a `.prompt.md` file only when `operationMode` is `file`. The manifest SHALL show the Process button in the editor title bar under the same condition.

#### Scenario: SCN-FILE-004-1 Manual mode
- **WHEN** `operationMode` is `manual` and a `.prompt.md` file with no feedback header is open
- **THEN** the code lens provider returns no lens

### Requirement: REQ-FILE-005 Use This Version
The code lens `Use This Version` SHALL appear on a `.prompt.md` file whose leading comment holds a feedback id, in every operation mode. `promptBooster.usePromptVersion` SHALL remove the HTML comments, finalize the feedback record with the remaining text, and send that text to the chat with a clipboard fallback. A failure to finalize SHALL be logged and SHALL not stop the send.

Refs: REQ-FBK-002, REQ-FBK-012

#### Scenario: SCN-FILE-005-1 An edited file is used
- **WHEN** the user edits a generated file that holds the feedback id `abc` and clicks `Use This Version`
- **THEN** the record `abc` becomes `edit-finalized` with the edited text, and the chat opens with that text
