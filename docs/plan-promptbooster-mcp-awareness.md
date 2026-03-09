# Prompt Plan: PromptBooster MCP-Aware Tool Provisioning

> **Goal:** Enable PromptBooster to discover user-configured MCP servers and weave their tool references into enhanced prompts — so the downstream agent immediately picks the best tool.
>
> **Reference spec:** [promptbooster-enhancement-spec.md](promptbooster-enhancement-spec.md) — Enhancement 4

---

## Architecture Overview

```mermaid
graph TB
    subgraph IDE["VS Code Extension (PromptBooster)"]
        direction TB
        UP[User Raw Prompt]
        WCG[WorkspaceContextGatherer<br/>Enhancement 2]
        RR[ReferenceResolver<br/>Enhancement 3]
        REG[MCPToolRegistry<br/>Enhancement 4]
        TAC[ToolAffinityClassifier<br/>Enhancement 1 + 4]
        SYS[OPTIMIZATION System Prompt<br/>+ dynamic MCP catalog]
        LLM[LLM Call]
        OUT[Enhanced Prompt<br/>with inline tool refs]
    end

    subgraph Config["MCP Configuration Sources"]
        MJ[".vscode/mcp.json"]
        SS["settings.json → mcp.servers"]
        RT["vscode.lm.tools API<br/>(future)"]
    end

    UP --> WCG
    UP --> RR
    Config --> REG
    REG --> TAC
    UP --> TAC
    WCG --> SYS
    RR --> SYS
    TAC --> SYS
    SYS --> LLM
    LLM --> OUT

    style REG fill:#f9a825,stroke:#f57f17,color:#000
    style TAC fill:#f9a825,stroke:#f57f17,color:#000
    style OUT fill:#66bb6a,stroke:#388e3c,color:#000
```

---

## Data Flow (Sequence)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant PB as PromptBooster Extension
    participant Reg as MCPToolRegistry
    participant Config as .vscode/mcp.json
    participant Clf as ToolAffinityClassifier
    participant LLM as Optimizer LLM
    participant Agent as Copilot Agent

    User->>PB: "analyze the slow dashboard query and fix it"

    Note over PB: Step 1 — Gather context<br/>(Enhancement 2: workspace signals)

    PB->>Reg: discover()
    Reg->>Config: Read MCP server configs
    Config-->>Reg: servers: [postgres-mcp, github-mcp]
    Reg-->>PB: MCPToolDescriptor[]:<br/>postgres-mcp.query_db,<br/>postgres-mcp.list_tables,<br/>github-mcp.create_pull_request

    Note over PB: Step 2 — Classify tools<br/>(Enhancement 1 + 4)

    PB->>Clf: classifyTools(prompt, mcpCatalog)
    Note over Clf: Score built-in tools:<br/>#file (0.5), #terminalLastCommand (0.3)
    Note over Clf: Score MCP tools:<br/>postgres-mcp.query_db (4),<br/>github-mcp.create_pull_request (0)
    Clf-->>PB: suggestedTools + mcpTools + toolAnnotations

    Note over PB: Step 3 — Build prompt with<br/>context + MCP catalog + guidance

    PB->>LLM: System prompt + workspace context<br/>+ filtered MCP tool catalog<br/>+ user prompt + placement guidance
    LLM-->>PB: Enhanced prompt with inline tool refs:<br/>"Run EXPLAIN ANALYZE via `postgres-mcp.query_db`...<br/>fix #file:src/data/userDashboard.ts..."

    PB->>Agent: Enhanced prompt
    Note over Agent: Agent sees exact tool names<br/>at exact sentences → immediate<br/>tool selection, no guesswork
```

---

## MCP Tool Discovery Flow

```mermaid
flowchart LR
    subgraph Discovery["MCPToolRegistry.discover()"]
        A["Read .vscode/mcp.json"] --> D{Tools found?}
        B["Read settings.json<br/>mcp.servers"] --> D
        C["vscode.lm.tools API<br/>(future)"] --> D
        D -->|Yes| E["MCPToolDescriptor[]<br/>serverName + toolName + description"]
        D -->|No servers| F["Empty catalog<br/>(graceful — pipeline unchanged)"]
    end

    E --> G["ToolAffinityClassifier<br/>scores MCP tools against prompt"]
    G --> H{"Score > 0?"}
    H -->|Top 5| I["Inject into system prompt<br/>+ placement guidance"]
    H -->|None match| J["Skip — only built-in tools used"]
```

---

## Classification Scoring Logic

```mermaid
flowchart TD
    P["User prompt words"] --> B["Built-in tool scoring<br/>(regex signal map)"]
    P --> M["MCP tool scoring<br/>(keyword match on description)"]

    B --> BF["Filter: score > 0"]
    M --> MF["Filter: score > 0, top 5"]

    BF --> G["Merge placement guidance"]
    MF --> G

    G --> OUT["toolAnnotations string<br/>injected into LLM prompt"]

    subgraph MCP Scoring
        M1["Split tool.description into words"]
        M2["Match each word (len>3) against prompt"]
        M3["Bonus: server name or tool name in prompt → +2"]
        M1 --> M2 --> M3
    end
```

---

## Implementation Phases

### Phase 4a — MCP Config Discovery

```
MCPToolRegistry.ts
├── discoverFromMcpJson()      → parse .vscode/mcp.json
├── discoverFromSettings()     → parse workspace settings
├── discoverFromRuntime()      → vscode.lm.tools (future, no-op now)
├── getToolCatalog()           → MCPToolDescriptor[]
└── formatForSystemPrompt()    → compact string for LLM injection
```

**Tasks:**

- [ ] Create `src/core/services/MCPToolRegistry.ts`
- [ ] Register `TYPES.MCPToolRegistry` in DI container
- [ ] Inject into `RealtimeModeStrategy` constructor
- [ ] Unit test: parsing `.vscode/mcp.json` with 0, 1, 5 servers
- [ ] Unit test: deduplication across config sources

### Phase 4b — Extended Classification

**Tasks:**

- [ ] Extend `classifyTools()` signature to accept `mcpCatalog` param
- [ ] Add keyword-matching scorer for MCP tool descriptions
- [ ] Add server/tool name bonus scoring
- [ ] Hard cap at top 5 MCP tools per request
- [ ] Merge MCP placement guidance with built-in guidance
- [ ] Unit test: prompt "query the database" → matches `postgres-mcp.query_db`
- [ ] Unit test: prompt "fix the bug" → zero MCP matches, only built-in

### Phase 4c — Prompt Integration

**Tasks:**

- [ ] Inject filtered MCP catalog into `buildPromptWithContext()`
- [ ] Extend `PromptResult` with `mcpTools?` field
- [ ] Update `renderInteractiveResponse()` to show MCP tool tags
- [ ] Integration test: end-to-end with mock MCP config

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MCP tool schemas aren't always well-described | Fall back to server name + tool name matching |
| Too many tools overwhelm the classifier | Hard cap at top 5; weight by description match quality |
| VS Code MCP API isn't stable yet | Start with config file parsing; add runtime API later |
| Enhanced prompt references a tool the agent can't access | Only reference tools from user's own MCP config |
| Config parsing fails | Graceful fallback — empty catalog, pipeline unchanged |

---

## Success Criteria

1. With `postgres-mcp` and `github-mcp` configured, a prompt mentioning "database" and "PR" produces an enhanced prompt containing `postgres-mcp.query_db` and `github-mcp.create_pull_request` inline
2. With zero MCP servers configured, output is identical to Enhancement 1–3 alone
3. Classification adds <5ms latency (keyword matching, no LLM call)
4. No more than 5 MCP tools injected per request regardless of catalog size
