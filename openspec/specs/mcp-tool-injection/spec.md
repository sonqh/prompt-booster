# mcp-tool-injection Specification

## Purpose
How PromptBooster picks the MCP tools that fit a prompt and puts them in the optimizer input. It covers the scorer, the cap, the visibility filter, the catalog block, and the rule that a prompt with no fitting tool is unchanged.

## Requirements

### Requirement: REQ-INJ-001 MCP tool score
`classifyTools` SHALL score each enabled MCP tool with no model call. Content tokens are description words of 4 or more characters that are not stopwords. A content token that is in the prompt SHALL add 2 when it has 6 or more characters and 1 if not. The sum SHALL be divided by the square root of the count of content tokens. A whole-word match of the server name or the tool name in the prompt SHALL add 4 each. A tool SHALL qualify at a score of 2.0 or more.

Refs: ADR-002

#### Scenario: SCN-INJ-001-1 One generic token
- **WHEN** only one generic description token matches the prompt
- **THEN** the tool does not qualify

#### Scenario: SCN-INJ-001-2 Several tokens
- **WHEN** several description tokens match the prompt
- **THEN** the tool qualifies

#### Scenario: SCN-INJ-001-3 A stopword
- **WHEN** the only shared word between the prompt and a filesystem tool is `file`
- **THEN** the tool does not qualify

#### Scenario: SCN-INJ-001-4 A disabled tool
- **WHEN** a tool with `enabled: false` has a score above the threshold
- **THEN** `mcpTools` does not hold it

#### Scenario: SCN-INJ-001-5 A long description
- **WHEN** a focused tool and a tool with a long list description match the same prompt words
- **THEN** the focused tool ranks first

### Requirement: REQ-INJ-002 Cap and order
`classifyTools` SHALL return at most 5 MCP tools. The order SHALL be: larger name bonus, then larger score, then shorter description, then qualified name in ascending order. The same input SHALL give the same output order.

Refs: ADR-002

#### Scenario: SCN-INJ-002-1 More than five tools qualify
- **WHEN** ten tools qualify
- **THEN** `mcpTools` holds at most five

#### Scenario: SCN-INJ-002-2 The server name is in the prompt
- **WHEN** the prompt holds the server name of one tool as a whole word
- **THEN** that tool qualifies and is first

#### Scenario: SCN-INJ-002-3 Two runs
- **WHEN** `classifyTools` runs twice on the same prompt and catalog
- **THEN** both runs return the same tools in the same order

### Requirement: REQ-INJ-003 Visibility filter
`RealtimeModeStrategy` SHALL classify against `getInjectableCatalog` when `mcp.includeForeignServers` is off. It SHALL classify against `getToolCatalog` when the setting is on. A foreign tool that is injected SHALL carry `other-editor tool` in the catalog block and in its guidance line, and `(other-editor)` in the chat tag.

Refs: REQ-DISC-003, ADR-002

#### Scenario: SCN-INJ-003-1 Only foreign tools exist
- **WHEN** the catalog holds only foreign tools and the setting is off
- **THEN** the optimizer input holds no MCP block and the response shows no MCP tag

#### Scenario: SCN-INJ-003-2 The user opts in
- **WHEN** the setting is on and a foreign tool qualifies
- **THEN** the optimizer input holds the tool with the `other-editor tool` note

### Requirement: REQ-INJ-004 Catalog block
`formatForSystemPrompt` SHALL return the empty string for no tools. If not, it SHALL print one line per tool with the qualified name, description, and input summary. It SHALL replace control characters in a description with spaces, collapse spaces, and cut it at 200 characters. It SHALL stop the list with a truncation line when the lines pass 1,500 characters. It SHALL end with guidance that the agent omits a reference it cannot resolve.

Refs: ADR-002

#### Scenario: SCN-INJ-004-1 No tools
- **WHEN** the tool list is empty
- **THEN** the result is the empty string

#### Scenario: SCN-INJ-004-2 A description with line breaks
- **WHEN** a description holds control characters, line breaks, and 300 characters
- **THEN** the printed description has one line, single spaces, and at most 200 characters

#### Scenario: SCN-INJ-004-3 Many tools
- **WHEN** the tool lines pass the 1,500 character budget
- **THEN** the block ends the list with `(tool list truncated to stay within the prompt budget)`

#### Scenario: SCN-INJ-004-4 The guidance text
- **WHEN** the block holds one tool
- **THEN** it says that the names are semantic identifiers, that runtime ids can differ, and that an unresolved reference is omitted

### Requirement: REQ-INJ-005 No tool, no change
When no MCP tool qualifies, the optimizer input and the chat response SHALL be the same as with no MCP support. The strategy SHALL read the catalog through `ensureCatalog` and SHALL not run `discover` for a request.

Refs: REQ-DISC-007, REQ-ENH-007

#### Scenario: SCN-INJ-005-1 An empty catalog
- **WHEN** the MCP catalog is empty
- **THEN** the optimizer input equals the input that Enhancements 1 to 3 build alone

#### Scenario: SCN-INJ-005-2 The cached registry
- **WHEN** a chat request runs
- **THEN** the strategy calls `ensureCatalog` and does not call `discover`

### Requirement: REQ-INJ-006 MCP placement guidance
For each qualified MCP tool, `toolAnnotations` SHALL hold a line that tells the model to embed the qualified name in the sentence where the tool is needed. The description in that line SHALL have control characters removed and SHALL be cut at 200 characters.

Refs: REQ-ENH-006

#### Scenario: SCN-INJ-006-1 A matched MCP tool
- **WHEN** an MCP tool qualifies
- **THEN** `toolAnnotations` holds a line with the qualified name in backticks
