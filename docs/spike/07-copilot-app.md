# 07 The Copilot app

Change `002-plugin-spike`, task 2.4. REQ-SKILL-006

Question: does the Copilot app install the fixture and run the skill?

Status: not run. This file holds no result.

## Header

Fill these lines when you run the check. Keep each line at the start of a line, outside a comment.

date:
version: copilot-app:

How to read each version:

- `copilot-app` (Copilot app): the version in the About dialog

## Steps

### copilot-app

1. Use `n/a` when you have no access to the Copilot app. Write that in the note.
2. Install the fixture with each form of check 01 that the app offers.
3. Run the skill with the argument `hello 42`.
4. Pass: the reply holds `SPIKE-ECHO args=[hello 42]`. Fail: the install or the skill fails.

## Notes

- ADR-004 names the Copilot app as a target only when this check passes.

## Results

No result yet. Each line below is a template inside a comment. The Verify command does not read a comment.
For each line, write it below the comments, at the start of a line, without the comment marks, with one value of `pass`, `fail`, or `n/a` and a short note.

<!-- template: result: copilot-app: pass|fail|n/a (note) -->
