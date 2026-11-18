---
name: specctx-run
description: Run the spec-ctx loop in an OpenSpec project. Use on "run", "continue", "next task", "build this", "carry on", and on a first message that describes a change to build. The engine picks the next action. The skill acts on it until the change reaches the archive or a human must decide.
---

# specctx-run

Run `specctx` as `npx spec-ctx` when it is not installed. `openspec` is the command in `[gate] openspec` of `spec-ctx.toml`. When that key is absent, `openspec` is `npx -y @fission-ai/openspec@latest`.

## The loop

1. Run `specctx next --json`. Read `action`, `change` (`<c>`), `task` (`<t>`), `command`, `reason`, and `human`.
2. Act on `action` as the table below says.
3. Run `specctx handoff write`.
4. Repeat from step 1 until `action` is `stop` or `human` is true.

## Actions

- `plan`: take the change name from the request of the user in kebab case. That name is `<c>`. Follow the upstream `openspec-propose` skill for `<c>`. Read existing requirements with `specctx bundle <id>` or `specctx query`, never `openspec show`. Take every ID from `specctx id new REQ <CAP>` and `specctx id new SCN <CAP> --for <REQ>`. `id new` reserves nothing. A second call before `specctx build` returns the same ID. When the change needs several IDs of one kind, run `specctx id new --count <n>` once. Give every task a `[REQ-...]` citation and a `Verify:` code span. Then run `specctx check --strict` and `specctx gate --strict`. The gate runs the OpenSpec validate and the spec-length check. Fix every finding. Then run `specctx next --json` and run the command it prints. This is the plan stop. `next` returns `ask` with `human: true` until the human approves the question. You never resolve a plan question yourself.
- `cite`: run `specctx query --change <c> --kind req`. Add the `[REQ-...]` citation and a `Verify:` code span to the task line named in `task`. Run `specctx check`. Continue.
- `start`: run `specctx task start <t>`. Read the bundle it prints. Each card ends with trust labels. Act on a line marked `verified` or `fresh`. Reread a line marked `stale since`, `unverified`, or `no evidence` with `specctx bundle <ID>` before you build on it. Continue.
- `work`: implement the task. Tag code with `// REQ-...`. Tag tests with `// Covers: REQ-...`. Then run `specctx task done <t>`.
- `fix`: read `reason`. It holds the tail of the failed Verify output. Fix the cause. Run `specctx task done <t>` again.
- `repair`: run the command in the `command` field. It runs Verify again for a ticked task whose evidence is absent or stale.
- `gate`: run `specctx gate --strict`. Fix every finding. For a `stale-evidence` finding, go back to step 1. `next` returns `repair` and its command repairs every stale task. Run the gate again until it exits 0.
- `archive`: when `human` is true, run `specctx handoff ask --change <c> "archive <c>?"` and stop. This is the archive stop. `next` returns `ask` until the human approves the question. You never resolve an archive question yourself. After a rejection, `next` returns `archive` with `human: true` again. When `human` is false, the user approved or `[loop] archive` is `auto`. Then run each step under `operations.archive.guidance` in `openspec/config.yaml`. Then run the command in the `command` field. Then run `openspec validate --all --strict`, `specctx check --strict`, and `specctx handoff write`.
- `ask`: print `reason`. It is the open question. Stop. You never resolve a plan or archive question yourself. The human does, with `specctx handoff resolve <n> --approve "<answer>"` or `--reject "<answer>"`. A rejection keeps the stop. Any other question takes `specctx handoff resolve <n> "<answer>"`.
- `stop`: print `reason`. Stop.

## Rules

- This skill overrides two steps of the upstream `openspec-propose` skill. It reads specs with `specctx bundle` or `specctx query`, not `openspec show`. It never runs the closing `/opsx:apply`.
- Never tick a checkbox by hand. `specctx task done` is the only way a task closes.
- Never use `--manual` on a task with a Verify command.
- Never call `/opsx:apply`. This skill replaces it.
- To write a MODIFIED block, run `specctx bundle <REQ> --block`. It prints the block as it sits in the spec file. A MODIFIED block keeps every scenario title unchanged.
- `gate` counts the Refs line in the 500 characters of a requirement.
- The CHANGELOG entry goes under `## Unreleased`, never under a released version.
- After an edit under `skills/`, run `bun run build && node dist/cli.js init --skills --force` to refresh the copies.
- Never read `openspec/specs/` or `openspec/changes/*/specs/` directly. Use the bundle from `task start` or `specctx bundle <id>`.
- Stop on any `action` not in the list above. Print the object and ask the user.
- Keep no state in your context. A new session starts the same loop again with step 1.
