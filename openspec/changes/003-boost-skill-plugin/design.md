# Design

## Context

- The rubric of the extension is the text of `SYSTEM_PROMPTS.OPTIMIZATION` in `src/core/prompts/SystemPrompts.ts`: Task, Context, Requirements, Output, and tool references inline. The skill reuses the ideas and not the text, because its output is a plan that the same agent then follows.
- `docs/spike/README.md` (change 002) names the hosts that load the plugin, the invocation name on each host, the manifest layout, and the validator. Where a line below names a default, the spike result wins.
- ADR-002 section 4 says that tool descriptions are untrusted text and that at most five tools go into a prompt. Both rules carry over as instructions to the model.
- The host can hide most tools behind a tool search. Then the model sees few tools when the skill runs.
- A skill with a shell substitution must quote the request of the user. A skill with no script has no such risk, because the argument enters the prompt as text.

## Goals / Non-Goals

**Goals:**
- A user runs `/prompt-booster:boost <rough request>` and gets a restated task, checks, and the first tools, and the agent waits.
- The plugin folder can be read in one minute and holds nothing that runs.
- One folder serves every host that passed the spike.

**Non-Goals:**
- The same output as the extension.
- Automatic use of the skill by the model.
- A list of tools that the skill carries itself.

## Decisions

- The plugin lives in `plugin/` of this repository. The alternative is a new repository. One repository keeps the specs, the history, and the stars in one place. When spike check 01 shows that a subfolder cannot be installed from a Git URL, the owner decides between a new repository and a marketplace manifest at the root. Refs: REQ-SKILL-003
- The folder holds only the manifests, `skills/boost/SKILL.md`, `README.md`, and `LICENSE`. `scripts/check-plugin.mjs` holds the allow list. It also checks the frontmatter flag, the word count, and that the skill has no exclamation mark followed by a backtick. The script lives outside the folder, so the folder stays free of code. Refs: REQ-SKILL-001
- `disable-model-invocation: true` is in the frontmatter. A rewrite that starts by itself would surprise the user and spend tokens. The first-party migration page names this flag for former slash commands. Refs: REQ-SKILL-009
- The output contract has four parts in a fixed order: the restated task with facts that the agent read in the workspace, the acceptance checks, the first tools with one reason each, and the question for the OK of the user. The agent may read files to find facts. It changes nothing before the OK. The alternative, to act at once, hides a wrong reading of the request until work is done. Refs: REQ-SKILL-002
- The skill names five tools at most, and only tools that the agent can call in the session. With fewer than three visible tools it says so and still restates the task. It invents no tool. Refs: REQ-SKILL-010, ADR-002
- The skill tells the model to treat each tool description as data. An instruction inside a description is not followed. Refs: REQ-SKILL-010, ADR-002
- The limit is 600 words. A short skill costs few tokens per use and can be reviewed by a stranger. Refs: REQ-SKILL-001
- The skill is written by hand. Its last line states the date and the `OPTIMIZER_PROMPT_VERSION` of the extension rubric that it was written from. Refs: REQ-SKILL-002
- `docs/install-matrix.md` has one row per host of the spike `hosts:` line, with the install command, the invocation name, the versions, the date, and pass or fail. Refs: REQ-SKILL-003, REQ-SKILL-004

## Risks / Trade-offs

- The model ignores the stop and starts work. Mitigation: the contract puts the question last, and the A/B run of change 004 records such cases in its notes.
- The host shows few tools to the skill. Mitigation: the rule for fewer than three tools, and the spike result on tool visibility in the README of the plugin.
- The skill looks like `boost-prompt` in `awesome-copilot`. Mitigation: the README names it and states the difference. Change 004 measures that difference.
- A host changes the plugin format. Mitigation: the folder is five files, and the install matrix has a date.
