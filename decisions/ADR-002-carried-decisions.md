# ADR-002 Architecture decisions carried from the legacy design documents

Status: proposed. Date: 2026-11-18.

## Context

The legacy design documents hold decisions that the code follows today. ADR-001 freezes those documents. This record carries each decision that a future change must not break, with its source. It adds no new decision.

## Decision

### 1. The tool scorer calls no language model

`classifyTools` scores built-in tools and MCP tools with fixed patterns and token arithmetic. It adds no latency and no cost to a request, and the same input gives the same output.

Source: `docs/promptbooster-enhancement-spec.md`, "Enhancement 1", and `docs/plans/mcp-aware-tool-provisioning-v2.md`, section 7 "Scorer v2".

### 2. At most five MCP tools go into one prompt

A workspace can hold tens of tools. The scorer keeps the five best, and a tool must reach a score of 2.0 to count. Precision matters more than recall, because a wrong tool reference costs the agent a turn.

Source: `docs/promptbooster-enhancement-spec.md`, "Enhancement 4", design principle 2, and the v2 plan, section 7.

### 3. Discovery reads and never executes. The probe is opt-in

Discovery reads config files and the VS Code runtime tool list. It starts no server. The one piece of code that starts a server is the probe. The probe is off by default (`promptBooster.mcp.probeServers`), has hard time limits of 2, 3, and 6 seconds, and never runs for a chat request.

Source: the v2 plan, section 3 "Decision record", the "Secondary" paragraph and the rejected alternative "Probe on by default, in-request".

### 4. Tool descriptions are untrusted text

A tool description comes from a third party and enters the optimizer prompt. The code removes control characters and line breaks, cuts each description at 200 characters, keeps the tool list in about 1,500 characters, and tells the agent to omit a reference that it cannot resolve.

Source: the v2 plan, section 3 "Reference-format fidelity", and section 9 "Risks and mitigations".

### 5. Tools from the config of another editor are not injected by default

The agent that receives the prompt is VS Code Copilot. A tool from a Claude Desktop, Claude Code, Cursor, or Cline config can be absent there. Such a tool has visibility `foreign` and stays out unless the user sets `promptBooster.mcp.includeForeignServers`. An injected foreign tool carries a note.

Source: the v2 plan, section 3 "F2 decisions", the visibility table.

### 6. The privacy defaults are conservative

- Prompts and feedback records live in VS Code workspace state, never in a file that git can commit.
- Few-shot examples send accepted prompts to the model provider again. The setting `promptBooster.learning.fewShotFromFeedback` is off by default.
- The values of `env` in an MCP config are never written to a log.

Source: the v2 plan, section 2 "Phase E design", and section 9.

### 7. The runtime tool list is the first source

When VS Code exposes `vscode.lm.tools`, that list wins over every config file, because it holds the tools that the agent can run and their real descriptions. The order after it is: probe cache, manual index, inline schema, stub.

Source: the v2 plan, section 3, "Primary discovery path".

### 8. No tool, no change

With no MCP tool that fits, the optimizer input and the response are the same as with no MCP support. A test asserts this.

Source: `docs/promptbooster-enhancement-spec.md`, "Enhancement 4", design principle 4, and the v2 plan, section 10, criterion 4.

## Consequences

A change that breaks one of these decisions needs a new ADR that replaces the section.

Refs: REQ-ENH-005, REQ-INJ-001, REQ-INJ-002, REQ-INJ-003, REQ-INJ-004, REQ-INJ-005, REQ-PROBE-001, REQ-PROBE-004, REQ-DISC-002, REQ-DISC-003, REQ-FBK-003, REQ-FBK-009, REQ-CFG-005
