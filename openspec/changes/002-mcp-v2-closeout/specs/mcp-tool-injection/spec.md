# Spec Delta

## ADDED Requirements

### Requirement: REQ-INJ-007 Golden-set gate
The repository SHALL hold a golden set at `src/test/fixtures/mcp-golden-prompts.json` with a tool catalog and at least 20 prompts, each with its expected MCP tools. A test SHALL run `classifyTools` on each prompt and compute precision and recall over the full set. The test SHALL fail when precision is under 0.8 or recall is under 0.6. The test SHALL run with no VS Code host.

Refs: REQ-INJ-001, REQ-INJ-002, ADR-002

#### Scenario: SCN-INJ-007-1 The scorer meets the gate
- **WHEN** the golden-set test runs on the current scorer
- **THEN** it reports precision of 0.8 or more and recall of 0.6 or more, and it passes

#### Scenario: SCN-INJ-007-2 The scorer gets worse
- **WHEN** a change to the scorer drops precision to 0.7
- **THEN** the golden-set test fails and prints the precision

#### Scenario: SCN-INJ-007-3 A prompt that needs no tool
- **WHEN** a golden prompt has an empty `expectedTools` list and the scorer injects a tool
- **THEN** that tool counts against precision
