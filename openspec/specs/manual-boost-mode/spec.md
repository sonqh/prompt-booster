# manual-boost-mode Specification

## Purpose
How the `PromptBooster: Boost This Prompt` command rewrites text in an editor. It covers the text that the command takes, the model call, and the edit that replaces the text in place.

## Requirements

### Requirement: REQ-BOOST-001 Boost target
`promptBooster.boost` SHALL take the document of the given URI, or the active editor document when no URI is given. It SHALL take the selection when the active editor shows that document and the selection is not empty. In every other case it SHALL take the full document. With no document it SHALL show `No document to boost`. The manifest SHALL show the command in the editor context menu and the editor title bar only for files that end in `.prompt.md`.

#### Scenario: SCN-BOOST-001-1 A selection exists
- **WHEN** the user selects lines 3 to 5 of an open `.prompt.md` file and runs the command
- **THEN** the strategy receives the selected text and the range of lines 3 to 5

#### Scenario: SCN-BOOST-001-2 No selection
- **WHEN** the user runs the command with an empty selection
- **THEN** the strategy receives the full document text and the full document range

### Requirement: REQ-BOOST-002 Replace in place
`ManualModeStrategy.execute` SHALL get a model from `getModel`, call `optimize` under a cancellable progress notice, and replace the given range with the result through one workspace edit. Empty text SHALL give the warning `No text to optimize`. No model SHALL end the run with no edit. A missing document URI or range SHALL log an error and make no edit. The call SHALL add no workspace context, references, or MCP tools.

Refs: REQ-ENH-001, REQ-CFG-002

#### Scenario: SCN-BOOST-002-1 No model
- **WHEN** the model provider returns no model
- **THEN** the optimizer is not called and the document does not change

#### Scenario: SCN-BOOST-002-2 The mode check
- **WHEN** `canHandle` runs
- **THEN** it returns true for `manual` and false for `realtime` and `file`
