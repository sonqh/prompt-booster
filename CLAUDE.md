# CLAUDE.md

See [AGENTS.md](AGENTS.md) for project architecture, build/test commands, and conventions — Claude Code should follow those guidelines.

## Delegated development roles

This project uses a PO → Architect → Developer → QA workflow (see AGENTS.md's "Delegated Development Workflow" section). The corresponding subagents live in `.claude/agents/`: `po`, `architect`, `developer`, `qa`. Invoke with `@po`, `@architect`, `@developer`, `@qa`, or ask Claude to chain them (e.g. "use the po subagent to scope this, then hand off to architect").
