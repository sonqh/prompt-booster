# prompt-feedback-learning Specification

## Purpose
How PromptBooster records what the user does with an enhanced prompt and uses that record. It covers the feedback log, the labels on tool references, the optimizer response cache, the opt-in few-shot examples, and the two report commands. All records stay in workspace state.

## Requirements

### Requirement: REQ-FBK-001 Pending record at render time
`RealtimeModeStrategy` SHALL create one pending feedback record when it renders an enhancement. The record SHALL hold the raw prompt, the enhanced prompt, the intent, the built-in tool tags, the MCP references, and the catalog fingerprint. It SHALL also hold `request.toolCalls` names when the chat request has them. `createPending` SHALL return the record id. With `feedback.enabled` false it SHALL return nothing and write nothing.

Refs: REQ-CHAT-005

#### Scenario: SCN-FBK-001-1 A record is created
- **WHEN** `createPending` runs with capture on
- **THEN** it returns an id and workspace state holds one pending record

#### Scenario: SCN-FBK-001-2 Capture is off
- **WHEN** `feedback.enabled` is false
- **THEN** `createPending` returns `undefined` and the pending key stays unset

#### Scenario: SCN-FBK-001-3 Observed tool calls
- **WHEN** the chat request carries a `toolCalls` list with names
- **THEN** the pending record holds those names in `observedToolCalls`

### Requirement: REQ-FBK-002 Outcome state machine
A pending record SHALL move to `accept`, `reject`, or `edit-opened` through `resolve`. An `edit-opened` record SHALL move to `edit-finalized` one time through `finalizeEdit`, which stores the final text. `accept` and `reject` SHALL be final. A call with an unknown id, or `finalizeEdit` on a record that is not `edit-opened`, SHALL change nothing.

#### Scenario: SCN-FBK-002-1 The three decisions
- **WHEN** three pending records resolve to `accept`, `reject`, and `edit-opened`
- **THEN** the resolved list holds the three records with those outcomes and the pending list is empty

#### Scenario: SCN-FBK-002-2 An edit is finalized
- **WHEN** `finalizeEdit(id, text)` runs on an `edit-opened` record
- **THEN** the record has outcome `edit-finalized` and `finalText` equals `text`

#### Scenario: SCN-FBK-002-3 A final outcome
- **WHEN** `resolve(id, "reject")` runs on a record that is already `accept`
- **THEN** the record stays `accept`

#### Scenario: SCN-FBK-002-4 An unknown id
- **WHEN** `resolve` or `finalizeEdit` runs with an id that no record has
- **THEN** no record changes and nothing throws

#### Scenario: SCN-FBK-002-5 Finalize too early
- **WHEN** `finalizeEdit` runs on a pending record
- **THEN** the record stays pending

### Requirement: REQ-FBK-003 Storage and retention
Feedback records SHALL live in workspace state under `promptbooster.feedback.pending` and `promptbooster.feedback.resolved`, and in no file. The resolved list SHALL keep at most `feedback.historyLimit` records and drop the oldest. A pending record older than 7 days SHALL be dropped at load. Resolved records SHALL load again after a window reload.

Refs: ADR-002

#### Scenario: SCN-FBK-003-1 The history limit
- **WHEN** the limit is 3 and five records resolve
- **THEN** the resolved list holds the last three

#### Scenario: SCN-FBK-003-2 An old pending record
- **WHEN** state holds a pending record that is 8 days old
- **THEN** a new log does not load it and `resolve` on its id changes nothing

#### Scenario: SCN-FBK-003-3 A reload
- **WHEN** a second log instance starts on the same state
- **THEN** its report counts the records that the first instance resolved

### Requirement: REQ-FBK-004 Reference labels
`deriveRefLabels` SHALL label each injected MCP reference of a record. For `edit-finalized` the label SHALL be `retained-strong` when the final text holds the qualified name, or holds both the server name and the tool name. If not, it SHALL be `removed`. For `accept` every label SHALL be `retained-weak`. For `reject` every label SHALL be `removed`. A `pending` or `edit-opened` record SHALL have no label.

#### Scenario: SCN-FBK-004-1 The name stays in the text
- **WHEN** the final text of an `edit-finalized` record holds `postgres-mcp.query_db`
- **THEN** that reference is `retained-strong`

#### Scenario: SCN-FBK-004-2 Both parts stay
- **WHEN** the final text holds the server name and the tool name apart
- **THEN** that reference is `retained-strong`

#### Scenario: SCN-FBK-004-3 Accept and reject
- **WHEN** one record is `accept` and one is `reject`
- **THEN** the first has only `retained-weak` labels and the second has only `removed` labels

#### Scenario: SCN-FBK-004-4 No decision yet
- **WHEN** a record is `pending` or `edit-opened`
- **THEN** it has no label

### Requirement: REQ-FBK-005 Feedback report
`getReport` SHALL return the pending count, the count of each outcome, the acceptance rate `accept / (accept + reject)`, the retention rate `retained / (retained + removed)` over `edit-finalized` records, and the precision of observed tool calls. A rate with a zero denominator SHALL be `null`. `promptBooster.showFeedbackReport` SHALL print these values, the cache hit rate, and the count of golden-set candidates to the output channel, and show the channel.

#### Scenario: SCN-FBK-005-1 No data
- **WHEN** state is empty
- **THEN** every count is 0 and every rate is `null`

#### Scenario: SCN-FBK-005-2 The acceptance rate
- **WHEN** three records are `accept` and one is `reject`
- **THEN** the acceptance rate is 0.75

#### Scenario: SCN-FBK-005-3 The retention rate
- **WHEN** an `edit-finalized` record keeps one of two references
- **THEN** the retention rate is 0.5

#### Scenario: SCN-FBK-005-4 Observed tool calls
- **WHEN** a resolved record has observed tool calls
- **THEN** the report holds the count of such records and a precision that is not `null`

### Requirement: REQ-FBK-006 Failure isolation
A failure in the feedback log, the response cache, or the learning store SHALL never fail an enhancement. A state read that throws SHALL give empty results. A state write that throws SHALL be logged. The strategy SHALL render the enhancement when any of the three services throws.

#### Scenario: SCN-FBK-006-1 The state write throws
- **WHEN** the state repository rejects a write
- **THEN** the log records a warning and the call does not throw

#### Scenario: SCN-FBK-006-2 The state read throws
- **WHEN** the state repository throws on read
- **THEN** `getReport` returns empty aggregates

#### Scenario: SCN-FBK-006-3 The feedback log throws
- **WHEN** `createPending` throws during a chat request
- **THEN** the stream still holds the optimized prompt

#### Scenario: SCN-FBK-006-4 The cache throws
- **WHEN** the response cache throws on `get`
- **THEN** the optimizer runs and the stream still holds the optimized prompt

#### Scenario: SCN-FBK-006-5 The learning store throws
- **WHEN** `getFewShotExamples` rejects
- **THEN** the enhancement renders with no few-shot block and an empty stamp

### Requirement: REQ-FBK-007 Response cache key
The cache key SHALL be the SHA-256 hex digest of five parts joined by a NUL character: `pb-cache-v1`, the raw prompt with white space collapsed and trimmed, the catalog fingerprint, `OPTIMIZER_PROMPT_VERSION`, and the few-shot stamp. The prompt SHALL not be lower-cased.

#### Scenario: SCN-FBK-007-1 White space
- **WHEN** two prompts differ only in white space
- **THEN** they have the same key

#### Scenario: SCN-FBK-007-2 Letter case
- **WHEN** two prompts differ in letter case
- **THEN** they have different keys

#### Scenario: SCN-FBK-007-3 Another input changes
- **WHEN** the catalog fingerprint, the few-shot stamp, or the optimizer prompt version changes
- **THEN** the key changes

### Requirement: REQ-FBK-008 Response cache behavior
A cache hit SHALL return the stored enhanced prompt and intent with no optimizer call. A miss SHALL call the optimizer and store the result. An entry older than `cache.ttlDays` SHALL be a miss and be dropped. The cache SHALL keep at most `cache.maxEntries` entries and drop the least recently used. With `cache.enabled` false, `get` SHALL miss and `put` SHALL do nothing. A stored entry with a wrong shape SHALL be a miss. The cache SHALL count hits and misses.

Refs: REQ-FBK-007

#### Scenario: SCN-FBK-008-1 A hit in a chat request
- **WHEN** the cache holds an entry for the request key
- **THEN** the optimizer is not called and the rendered text equals the stored text

#### Scenario: SCN-FBK-008-2 A miss in a chat request
- **WHEN** the cache holds no entry for the request key
- **THEN** the optimizer is called and the result is stored under that key

#### Scenario: SCN-FBK-008-3 An expired entry
- **WHEN** an entry is older than the TTL
- **THEN** `get` returns nothing

#### Scenario: SCN-FBK-008-4 The entry cap
- **WHEN** the cap is 3 and a fourth entry is stored
- **THEN** the least recently used entry is gone

#### Scenario: SCN-FBK-008-5 The cache is off
- **WHEN** `cache.enabled` is false
- **THEN** `get` misses, `put` stores nothing, and the rendered output equals the output with an empty cache

#### Scenario: SCN-FBK-008-6 Corrupt state
- **WHEN** the stored entries are not a list, or an entry has a wrong field type
- **THEN** `get` misses and does not throw

### Requirement: REQ-FBK-009 Few-shot selection
`getFewShotExamples` SHALL return nothing and SHALL not read the feedback log when few-shot is off. When on, it SHALL take `accept` and `edit-finalized` records only, newest first, and keep the newest of each prompt that is equal after white space is collapsed. It SHALL stop at `maxExamples`. It SHALL stop before an example that would make the rendered block longer than `charBudget`. An `edit-finalized` example SHALL use the final edited text.

Refs: ADR-002

#### Scenario: SCN-FBK-009-1 Only confirmed records
- **WHEN** the log holds `accept`, `reject`, `edit-opened`, and `edit-finalized` records
- **THEN** the examples come only from the `accept` and `edit-finalized` records

#### Scenario: SCN-FBK-009-2 A repeated prompt
- **WHEN** two confirmed records have the same normalized raw prompt
- **THEN** only the newer one is an example

#### Scenario: SCN-FBK-009-3 The character budget
- **WHEN** the next example would pass the budget
- **THEN** selection ends and the rendered block is not longer than the budget

#### Scenario: SCN-FBK-009-4 Few-shot is off
- **WHEN** `enabled` is false
- **THEN** the result is empty and `getConfirmedPositives` is not called

### Requirement: REQ-FBK-010 Few-shot block in the optimizer input
When `learning.fewShotFromFeedback` is on and examples exist, the strategy SHALL append the few-shot block after the assembled input. The few-shot stamp SHALL be the SHA-256 digest of the selected raw and enhanced texts, and it SHALL be part of the cache key. With the setting off, or with no example, the input SHALL not change and the stamp SHALL be the empty string. The block text SHALL come from `core/prompts/FewShotTemplates.ts`.

Refs: REQ-FBK-009, REQ-FBK-007, REQ-ENH-007

#### Scenario: SCN-FBK-010-1 Few-shot is on
- **WHEN** the setting is on and one example exists
- **THEN** the optimizer input ends with the few-shot block and the cache key uses a stamp that is not empty

#### Scenario: SCN-FBK-010-2 Few-shot is off
- **WHEN** the setting is off
- **THEN** the optimizer input has no block, the stamp is empty, and the learning store is not called

#### Scenario: SCN-FBK-010-3 No example
- **WHEN** the setting is on and no confirmed record exists
- **THEN** the optimizer input does not change and the stamp is empty

### Requirement: REQ-FBK-011 Golden-set candidates
`getGoldenSetCandidates` SHALL return one `{ prompt, expectedTools }` entry for each confirmed record that keeps at least one MCP reference. `promptBooster.exportMcpGoldenCandidates` SHALL write these entries as JSON to a file that the user picks in a save dialog. With no candidate it SHALL show a notice and write nothing. When the user cancels the dialog it SHALL write nothing.

#### Scenario: SCN-FBK-011-1 Kept references only
- **WHEN** an `edit-finalized` record keeps one of two references and an `accept` record has no reference
- **THEN** the candidates hold one entry with the one kept reference

#### Scenario: SCN-FBK-011-2 No confirmed record
- **WHEN** the log holds no confirmed record
- **THEN** the candidate list is empty

### Requirement: REQ-FBK-012 Feedback id in a prompt file
`extractFeedbackId` SHALL return the id from a line `PromptBooster-Feedback-Id: <id>` inside the leading HTML comment of a file. It SHALL return nothing when the file does not start with a comment, when the line is missing, or when the line is in another place. `stripHtmlComments` SHALL remove every HTML comment and trim the text.

#### Scenario: SCN-FBK-012-1 A generated file
- **WHEN** the leading comment holds `PromptBooster-Feedback-Id: abc-123`
- **THEN** `extractFeedbackId` returns `abc-123`

#### Scenario: SCN-FBK-012-2 An id in the body
- **WHEN** the id line is outside the leading comment
- **THEN** `extractFeedbackId` returns `undefined`

#### Scenario: SCN-FBK-012-3 Comments are stripped
- **WHEN** a text holds two HTML comments around `Do the task`
- **THEN** `stripHtmlComments` returns `Do the task`
