# prompt-enhancement-pipeline Specification

## Purpose
The steps that turn a raw prompt into the optimizer input and the optimizer output into a structured result. The pipeline gathers workspace context, resolves references, classifies built-in tools, and parses the model response. It states only what the code does today.

## Requirements

### Requirement: REQ-ENH-001 Structured optimizer response
`PromptOptimizationService.optimizeStructured` SHALL send the system prompt and the input to the given model and return `enhancedPrompt` and `intent` (`ask` or `edit`). It SHALL read the response as JSON, then as JSON inside a code fence, then as the first JSON object in the text. When none of these parse, it SHALL log one warning and return the full response as `enhancedPrompt` with intent `ask`. `optimize` SHALL return only `enhancedPrompt`.

#### Scenario: SCN-ENH-001-1 The model returns JSON
- **WHEN** the model returns `{"intent":"edit","enhancedPrompt":"Structured Edit"}`
- **THEN** the result has intent `edit` and enhanced prompt `Structured Edit`

#### Scenario: SCN-ENH-001-2 The model returns plain text
- **WHEN** the model returns `Not JSON`
- **THEN** the result has intent `ask`, the enhanced prompt is `Not JSON`, and the logger holds one warning

#### Scenario: SCN-ENH-001-3 The plain string form
- **WHEN** `optimize` runs and the model returns a JSON object with an `enhancedPrompt`
- **THEN** `optimize` returns that `enhancedPrompt` string

### Requirement: REQ-ENH-002 Workspace context preamble
`WorkspaceContextGatherer.gather` SHALL collect the active file path, language, cursor line, the 10 lines before and after the cursor, and a non-empty selection. It SHALL collect at most 10 other open files, at most 5 error or warning diagnostics, the git branch, and at most 15 dependency names from `package.json`. A missing git extension or `package.json` SHALL not fail the call. `formatAsPromptPreamble` SHALL print these under the heading `### Workspace Context (auto-gathered)`.

#### Scenario: SCN-ENH-002-1 An editor is active
- **WHEN** an editor is active with the cursor on line 42 and no selection
- **THEN** the preamble names the file, its language, `line 42`, and a code block with the lines around the cursor, and it has no `Selected Text` entry

#### Scenario: SCN-ENH-002-2 No package.json
- **WHEN** the workspace has no `package.json`
- **THEN** `gather` returns a context without `techStack` and does not throw

### Requirement: REQ-ENH-003 Inline reference tokens
`ReferenceResolver.resolveInlineTokens` SHALL replace `#file:<path>` with the path in backticks and add the file content. It SHALL replace `#selection` with `the selected code` and add the selection when one exists. It SHALL replace `#editor` with the active file path and add the file content. It SHALL keep `#terminalLastCommand` in the prompt and add a placeholder entry. File and editor content SHALL be cut at 8,000 characters. A file that cannot be read SHALL keep its token.

#### Scenario: SCN-ENH-003-1 A file token
- **WHEN** the prompt holds `#file:src/auth.ts` and the file exists in the first workspace folder
- **THEN** the clean prompt holds `` `src/auth.ts` `` and the resolved list holds one `file` entry with the content

#### Scenario: SCN-ENH-003-2 A long file
- **WHEN** a referenced file has 9,000 characters
- **THEN** the resolved content holds the first 8,000 characters and ends with `... [truncated at 8000 chars]`

### Requirement: REQ-ENH-004 Chat request references
`ReferenceResolver.resolve` SHALL turn each entry of `request.references` into a `### Reference:` block. A URI value SHALL give the file content, cut at 8,000 characters. A location value SHALL give the text of its range, labeled `<path>:<line>`. A string value SHALL give the string as a snippet. A value that cannot be read SHALL log a warning and be left out.

#### Scenario: SCN-ENH-004-1 A dropped file
- **WHEN** the chat request has one reference whose value is the URI of a file that holds `console.log('test')`
- **THEN** the optimizer input holds `console.log('test')`

### Requirement: REQ-ENH-005 Built-in tool classification
`classifyTools` SHALL score the nine built-in Copilot tools (`#file`, `#selection`, `#editor`, `#codebase`, `#terminalLastCommand`, `#terminalSelection`, `@workspace`, `@terminal`, `@vscode`) with fixed regular expressions, one point per matching pattern. It SHALL return every tool with a score above zero, highest score first. It SHALL call no language model.

Refs: ADR-002

#### Scenario: SCN-ENH-005-1 A prompt about the current file
- **WHEN** the prompt is `fix the bug in this file`
- **THEN** `suggestedTools` holds `#editor`

#### Scenario: SCN-ENH-005-2 A prompt about a failed run
- **WHEN** the prompt is `run the tests and check the error`
- **THEN** `suggestedTools` holds `@terminal` and `#terminalLastCommand`

#### Scenario: SCN-ENH-005-3 No signal
- **WHEN** the prompt matches no pattern
- **THEN** `suggestedTools` and `mcpTools` are empty

### Requirement: REQ-ENH-006 Tool placement guidance
`classifyTools` SHALL return `toolAnnotations`, a block that starts with `[Tool placement guidance` and holds one line per matched tool. Each line SHALL say where in the enhanced prompt the tool reference goes. The block SHALL be empty when no tool matches. The system prompt SHALL tell the model to embed tool references inline and to write no trailing `Tools` section.

#### Scenario: SCN-ENH-006-1 Nothing matches
- **WHEN** no built-in tool and no MCP tool matches the prompt
- **THEN** `toolAnnotations` is the empty string

#### Scenario: SCN-ENH-006-2 A tool matches
- **WHEN** at least one tool matches the prompt
- **THEN** `toolAnnotations` holds the guidance header and one line for each matched tool

### Requirement: REQ-ENH-007 Optimizer input assembly
`RealtimeModeStrategy` SHALL build the optimizer input from these parts, in this order, separated by one blank line: the workspace preamble, the inline reference blocks, the chat reference blocks, the MCP catalog block, and `### User Request` with the clean prompt and the tool guidance. An empty part SHALL be left out. The MCP catalog block SHALL appear only when at least one MCP tool qualifies.

Refs: REQ-ENH-002, REQ-ENH-003, REQ-ENH-004, REQ-ENH-006

#### Scenario: SCN-ENH-007-1 No MCP tool qualifies
- **WHEN** the MCP catalog is empty
- **THEN** the optimizer input holds the preamble and `### User Request` and holds no `Available MCP Tools` line
