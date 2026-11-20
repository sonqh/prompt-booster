---
name: echo
description: Spike fixture. Prints the marker SPIKE-ECHO and the argument of the user. Run it only when the user types the slash command.
argument-hint: "[text]"
disable-model-invocation: true
---

# echo

Reply with exactly one line and nothing else:

SPIKE-ECHO args=[$ARGUMENTS]

Rules:

- Copy the text between the square brackets as it is. Do not correct it.
- When the text between the brackets is the literal `$ARGUMENTS`, the host did not replace the argument. Print the line as it is.
- Call no tool. Add no other text.
