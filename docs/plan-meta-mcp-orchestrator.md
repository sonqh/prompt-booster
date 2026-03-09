# Prompt Plan: Meta-MCP Orchestrator

> **Goal:** Build a local Node.js MCP server that acts as a dynamic router and tool provisioner — spawning parallel lightweight LLM workers equipped with specific MCP tools to execute complex, multi-domain tasks.
>
> **Reference spec:** [meta-mcp-orchestrator-spec.md](meta-mcp-orchestrator-spec.md)
> **Complementary system:** [PromptBooster Enhancement Spec](promptbooster-enhancement-spec.md)

---

## System Architecture

```mermaid
graph TB
    subgraph Client["IDE / CLI Client"]
        U[User]
        P[Planner Agent<br/>Opus 4.6]
    end

    subgraph MetaMCP["Meta-MCP Server (Node.js)"]
        R[Router & Task Decomposer]
        WM[Worker Manager<br/>Thread Pool]
        TP[Tool Proxy Layer]
    end

    subgraph Workers["Ephemeral Workers"]
        W1[Haiku 4.5<br/>Worker 1]
        W2[Haiku 4.5<br/>Worker 2]
        W3[Haiku 4.5<br/>Worker 3]
    end

    subgraph MCPs["Local MCP Ecosystem"]
        DB[(Postgres MCP)]
        GIT[GitHub MCP]
        WEB[Browser MCP]
        FS[FileSystem MCP]
    end

    U -->|Complex task| P
    P -->|"delegate_agent_team()"| R
    R --> WM
    WM --> W1
    WM --> W2
    WM --> W3

    W1 <-->|query_db| TP
    W2 <-->|navigate, scrape| TP
    W3 <-->|create_pr| TP

    TP <--> DB
    TP <--> GIT
    TP <--> WEB
    TP <--> FS

    W1 --> R
    W2 --> R
    W3 --> R
    R -->|Aggregated JSON| P
    P -->|Final synthesis| U

    style R fill:#f9a825,stroke:#f57f17,color:#000
    style WM fill:#f9a825,stroke:#f57f17,color:#000
    style TP fill:#f9a825,stroke:#f57f17,color:#000
```

---

## End-to-End Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Planner as Opus 4.6 (IDE)
    participant MetaMCP as Meta-MCP Server
    participant Registry as MCP Registry
    participant Worker1 as Haiku Worker 1
    participant Worker2 as Haiku Worker 2
    participant Postgres as Postgres MCP
    participant GitHub as GitHub MCP

    User->>Planner: "Analyze the slow dashboard query,<br/>fix it, and push a PR"

    Note over Planner: Opus decomposes into sub-tasks:<br/>1. Profile query (needs DB)<br/>2. Fix code + push PR (needs GitHub)

    Planner->>MetaMCP: delegate_agent_team({<br/>  subTasks: [<br/>    { taskId: "profile", requires: ["postgres-mcp"] },<br/>    { taskId: "fix-and-pr", requires: ["github-mcp"] }<br/>  ]<br/>})

    Note over MetaMCP: Router reads mcp-registry.json<br/>to locate local MCP servers

    par Worker 1: Database Profiling
        MetaMCP->>Registry: Lookup postgres-mcp config
        Registry-->>MetaMCP: command: "npx postgres-mcp"
        MetaMCP->>Postgres: Connect (Stdio) + list_tools
        Postgres-->>MetaMCP: [query_db, list_tables]
        MetaMCP->>Worker1: Prompt + tool schemas: [query_db]
        Worker1-->>MetaMCP: tool_call: query_db("EXPLAIN ANALYZE...")
        MetaMCP->>Postgres: Proxy: execute query_db
        Postgres-->>MetaMCP: Query plan results
        MetaMCP-->>Worker1: Tool result
        Worker1-->>MetaMCP: Analysis: "Missing index on email column"
    and Worker 2: Code Fix + PR
        MetaMCP->>Registry: Lookup github-mcp config
        Registry-->>MetaMCP: command: "npx github-mcp"
        MetaMCP->>GitHub: Connect (Stdio) + list_tools
        GitHub-->>MetaMCP: [create_pr, list_repos, ...]
        MetaMCP->>Worker2: Prompt + tool schemas: [create_pr]
        Note over Worker2: Worker 2 waits for<br/>Worker 1's analysis<br/>(dependency chain)
    end

    MetaMCP->>Worker2: Inject Worker 1 result as context
    Worker2-->>MetaMCP: tool_call: create_pr({title: "Add index..."})
    MetaMCP->>GitHub: Proxy: execute create_pr
    GitHub-->>MetaMCP: PR #42 created
    Worker2-->>MetaMCP: "Applied index, PR created"

    MetaMCP-->>Planner: Aggregated results JSON:<br/>{ profile: "Missing index", fix: "PR #42 created" }

    Note over Planner: Opus reviews, synthesizes,<br/>presents final answer to user

    Planner-->>User: "Added index on email column.<br/>PR #42 pushed with before/after timings."
```

---

## Component Architecture

```mermaid
graph LR
    subgraph MetaMCP["Meta-MCP Server"]
        direction TB
        A["MCP Server Protocol<br/>(exposes tools to IDE)"] --> B["Router"]
        B --> C["Task Decomposer"]
        C --> D["Worker Manager"]
        D --> E["Thread Pool<br/>(Promise.allSettled)"]
        B --> F["MCP Client Pool<br/>(connections to local MCPs)"]
        F --> G["Tool Proxy<br/>(route tool_calls to MCPs)"]
        E --> H["Result Aggregator"]
        H --> A
    end

    subgraph Exposed["Tools Exposed to IDE"]
        T1["delegate_agent_team"]
        T2["list_available_mcps"]
        T3["health_check"]
    end

    subgraph Config["Configuration"]
        R1["mcp-registry.json"]
        R2[".env (API keys)"]
    end

    A --- T1
    A --- T2
    A --- T3
    Config --> F
```

---

## Tool Proxy Flow (per worker)

```mermaid
flowchart TD
    W["Haiku Worker"] -->|"tool_call: query_db(sql)"| MM["Meta-MCP Router"]
    MM --> L{"Lookup: which MCP<br/>owns 'query_db'?"}
    L -->|Found: postgres-mcp| C["MCP Client for postgres-mcp"]
    L -->|Not found| ERR["Return error to worker"]
    C --> E["Execute tool via Stdio"]
    E --> R["Raw result from Postgres MCP"]
    R --> T["Truncate if > budget"]
    T --> W
```

---

## Worker Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Meta-MCP receives sub-task
    Created --> Provisioned: Inject tool schemas<br/>from required MCPs
    Provisioned --> Running: Send prompt to<br/>Anthropic API (Haiku)
    Running --> ToolCalling: Worker issues tool_call
    ToolCalling --> Running: Meta-MCP proxies result back
    Running --> Completed: Worker returns final answer
    Running --> Failed: Timeout / Error
    Completed --> [*]: Result added to aggregation
    Failed --> [*]: Error logged, partial result returned
```

---

## Implementation Phases

### Phase 1 — Core Server Scaffold

```
meta-mcp-orchestrator/
├── src/
│   ├── index.ts                  # MCP Server entry point
│   ├── config/
│   │   └── registry.ts           # Load mcp-registry.json
│   ├── router/
│   │   └── taskRouter.ts         # Route sub-tasks to workers
│   ├── workers/
│   │   └── workerManager.ts      # Spawn & manage Haiku workers
│   ├── proxy/
│   │   └── mcpClientPool.ts      # Connect to local MCPs as client
│   │   └── toolProxy.ts          # Route tool_calls to correct MCP
│   └── tools/
│       └── delegateAgentTeam.ts   # Main tool schema + handler
├── mcp-registry.json             # Maps server names → commands
├── package.json
└── .env                          # ANTHROPIC_API_KEY
```

**Tasks:**

- [ ] Initialize Node.js project with `@modelcontextprotocol/sdk` and `@anthropic-ai/sdk`
- [ ] Implement MCP Server protocol (expose `delegate_agent_team` tool)
- [ ] Implement `mcp-registry.json` parser
- [ ] Test: server starts, exposes tool schema to IDE

### Phase 2 — MCP Client Pool & Tool Proxy

**Tasks:**

- [ ] Implement `mcpClientPool.ts` — connect to local MCPs via Stdio
- [ ] Implement `toolProxy.ts` — intercept worker `tool_call`, route to correct MCP
- [ ] Implement tool schema fetching (`list_tools`) from each connected MCP
- [ ] Test: proxy a `query_db` call from worker → Postgres MCP → result back

### Phase 3 — Worker Manager & Parallel Execution

**Tasks:**

- [ ] Implement `workerManager.ts` — spawn Haiku workers via Anthropic API
- [ ] Inject tool schemas into worker prompts
- [ ] Handle multi-turn tool_call loop (worker calls tool → proxy → result → worker continues)
- [ ] Implement `Promise.allSettled` parallel execution
- [ ] Implement timeout per worker (default: 30s)
- [ ] Test: 2 parallel workers, each using a different local MCP

### Phase 4 — Result Aggregation & Error Handling

**Tasks:**

- [ ] Implement result aggregation (JSON summary per sub-task)
- [ ] Handle worker failures gracefully (partial results)
- [ ] Handle dependency chains (worker B depends on worker A's output)
- [ ] Add logging and metrics (execution time, token usage per worker)
- [ ] Test: sub-task failure doesn't block other workers

### Phase 5 — IDE Integration & PromptBooster Synergy

**Tasks:**

- [ ] Register Meta-MCP in `.vscode/mcp.json` for VS Code
- [ ] Register Meta-MCP via `claude mcp add` for Claude Code
- [ ] Add system prompt guidance for Planner (when to delegate vs. do directly)
- [ ] Test combined flow: PromptBooster enhanced prompt → Agent delegates → Meta-MCP executes
- [ ] Document: setup guide for end users

---

## Configuration: `mcp-registry.json`

```json
{
  "servers": {
    "postgres-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": { "DATABASE_URL": "${DATABASE_URL}" }
    },
    "github-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    },
    "browser-mcp": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-puppeteer"]
    },
    "filesystem-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  }
}
```

---

## Metrics: Before vs. After

```mermaid
graph LR
    subgraph Before["Single Agent (Opus Only)"]
        direction TB
        B1["Sequential tool calls"]
        B2["100k+ tokens consumed"]
        B3["Context pollution"]
        B4["4-5 min per complex task"]
        B5["~$0.80 per task"]
    end

    subgraph After["Meta-MCP (Opus + Haiku Workers)"]
        direction TB
        A1["Parallel tool calls"]
        A2["<10k tokens (Opus)"]
        A3["Isolated worker contexts"]
        A4["~45s per complex task"]
        A5["~$0.20 per task"]
    end

    Before -.->|Improvement| After

    style Before fill:#ef5350,stroke:#c62828,color:#fff
    style After fill:#66bb6a,stroke:#388e3c,color:#fff
```

| Metric | Single Agent | Meta-MCP | Improvement |
|---|---|---|---|
| Execution | Sequential | Parallel | ~5x faster |
| Context (Planner) | 100k+ tokens | <10k tokens | 90% reduction |
| Cost | ~$0.80 | ~$0.20 | 75% cheaper |
| Hallucination risk | Medium-High | Near zero | Isolated contexts |
| IDE tool bloat | 50+ tools visible | 1 tool (`delegate_agent_team`) | Clean UX |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Local MCP server crashes mid-execution | Worker timeout + graceful error in aggregated result |
| Anthropic API rate limits | Configurable concurrency cap (default: 3 parallel workers) |
| Worker produces incorrect output | Planner (Opus) reviews all results before synthesizing |
| Sensitive data in worker context | Workers only receive files/schemas explicitly listed in sub-task |
| MCP Stdio connection issues | Retry with backoff; fall back to error message in result |

---

## Success Criteria

1. `delegate_agent_team` tool appears in IDE when Meta-MCP server is registered
2. 3 parallel Haiku workers complete within 60s total for a multi-domain task
3. Each worker only sees tools from its `required_mcp_servers` — no cross-contamination
4. Planner receives clean JSON aggregation and produces coherent final answer
5. Cost per complex task is <30% of equivalent single-agent execution
