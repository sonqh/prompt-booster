# 05 The default harness of VS Code

Change `002-plugin-spike`, task 2.2. REQ-SKILL-008

Question: which VS Code version made the Copilot harness the default, and what is the Session Target of a clean profile?

Status: not run. This file holds no result.

## Header

Fill these lines when you run the check. Keep each line at the start of a line, outside a comment.

date:
version: vscode-copilot:

How to read each version:

- `vscode-copilot` (VS Code with the Copilot harness): `code --version`, and the version of the Copilot Chat extension

## Steps

### vscode-copilot

1. Run `code --version`. Write the version in the header.
2. Create a clean profile. Open the chat view. Write down the Session Target that is selected.
3. Find the first version whose release notes name the Copilot harness as the default. Use only a first-party page, for example https://code.visualstudio.com/updates or https://code.visualstudio.com/docs/agents/run/move-to-copilot.
4. Pass: the clean profile selects Copilot and a first-party page names the version. Fail: the clean profile selects Local. Use `n/a` when no first-party page names a version, and say so in the note.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: source: https://(first-party page that names the version) -->
<!-- template: default-since: (VS Code version) -->
<!-- template: session-target: (value on a clean profile) -->
<!-- template: result: vscode-copilot: pass|fail|n/a (note) -->
