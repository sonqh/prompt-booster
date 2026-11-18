# 01 Install the fixture plugin

Change `002-plugin-spike`, task 1.2. REQ-SKILL-006

Question: which install form loads `docs/spike/fixture-plugin` on each host, and which command validates a plugin on each host?

Status: not run. This file holds no result.

## Header

Fill these lines when you run the check. Keep each line at the start of a line, outside a comment.

date:
version: vscode-copilot:
version: copilot-cli:
version: claude-code:

How to read each version:

- `vscode-copilot` (VS Code with the Copilot harness): `code --version`, and the version of the Copilot Chat extension
- `copilot-cli` (Copilot CLI): `copilot --version`
- `claude-code` (Claude Code): `claude --version`

## Steps

### All hosts

1. Try three forms on each host: a local folder, a Git URL of the branch that holds the fixture, and a Git URL with the subfolder path `docs/spike/fixture-plugin`.
2. After each try, type `/` in a session and look for a skill named `echo` of the plugin `spike-fixture`.
3. Write down each form that works and each form that fails, with the error text.

### vscode-copilot

1. Open a clean window. Set Session Target to Copilot.
2. Local folder: run the command `Chat: Install Plugin from Source` and give the absolute path of the fixture folder.
3. Local folder, second way: add the path to the setting `chat.pluginLocations` with the value `true`. The VS Code reference marks this setting as experimental.
4. Git URL: run `Chat: Install Plugin from Source` again with the repository URL. Then try `/plugin install <source>` in a Copilot session.
5. Record which manifest VS Code used. The fixture has a root `plugin.json` and a `.claude-plugin/plugin.json`.
6. Look for a validator command in the Command Palette. Record its name, or record that none exists.

### copilot-cli

1. Start `copilot` in an empty folder.
2. Type `/plugin` and read the help that it prints. Use the install form that the help shows for a local folder and for a Git URL.
3. Record the exact commands. This file does not name them because nobody checked them.
4. Record the validator command, or record that none exists.

### claude-code

1. Local folder: run `claude --plugin-dir <absolute path of the fixture folder>`.
2. Git URL: read `claude plugin --help` and use the install form that it shows. Record the exact command.
3. Validator: run `claude plugin validate <absolute path of the fixture folder>`. Record the output line.

## Notes

- The root `plugin.json` has no `$schema` field. The VS Code reference says that a root manifest with no other format marker is read as the Copilot format.
- When VS Code rejects the root manifest, add the `$schema` line of the Agent Plugins format from https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference and try one more time. Record that you did.
- The answer on the subfolder form feeds the owner question on a separate repository for the plugin.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: install: (host): (the form that works, for example local folder) -->
<!-- template: validator: (host): (command, or none) -->
<!-- template: result: vscode-copilot: pass|fail|n/a (note) -->
<!-- template: result: copilot-cli: pass|fail|n/a (note) -->
<!-- template: result: claude-code: pass|fail|n/a (note) -->
