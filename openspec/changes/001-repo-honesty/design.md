# Design

## Context

- `package.json` contributes one chat participant and no language model tool. Its description says "Enhance and optimize your prompts using AI before sending to GitHub Copilot". It has no `capabilities` entry. `promptBooster.mcp.probeServers` has no `scope`, and its description says that the probe runs "on activation, config change, or via the command". Only the command exists.
- The frozen extension keeps two known issues. `MCPToolRegistry.computeFingerprint` returns an unhashed string that can hold `env` values of the VS Code `mcp.servers` setting, and each feedback record stores it in workspace state. The probe has no workspace-trust check in code. The probe is off by default. The fix is the parked change `openspec/parked/mcp-v2-closeout`.
- `AGENTS.md` line 3 says that the extension "intercepts" prompts. Line 7 says that the Meta-MCP spec drives current work. Line 53 says that core services are testable without the `vscode` module. Seven core files import `vscode`.
- The Electron suite needs a display and a download of VS Code 1.109.0. It tests the frozen extension only.
- The plugin does not exist yet. Changes 002 and 003 build it. The README can name it as the direction, with no install command, until change 003.

## Goals / Non-Goals

**Goals:**
- A visitor learns in the first screen what works today, what is legacy, and why.
- No file in the repository claims behavior that the code does not have.
- A cloned repository that the user did not trust cannot activate the extension or turn the probe on.
- A pull request that breaks compile, lint, or a spec gate fails CI.

**Non-Goals:**
- A fix inside the frozen extension code.
- A release check script, a VSIX rule, or a dependency audit. The extension is never packaged for a store.
- Blocking CI on the Electron suite.

## Decisions

- The first 30 lines of the README are the "first screen". They hold the status, the plugin direction with a link to ADR-004, the legacy note with the date February 2027, and the link `https://code.visualstudio.com/api/extension-guides/ai/chat`. `@PromptBooster` moves below them, into a section named `Legacy VS Code extension`. A fixed line count makes the rule a `head` and `grep` check. Refs: REQ-REL-005
- The legacy section of the README has a `Known issues` list with the fingerprint issue and the missing trust check, in plain words, and says that the probe is off by default. Hiding them would repeat the fault that this change removes. Refs: REQ-REL-005, ADR-004
- `capabilities.untrustedWorkspaces.supported` is `false`. VS Code then does not activate the extension in an untrusted workspace. The parked design used `limited` with a trust check in code. `false` needs no code change, which fits a frozen extension. Refs: REQ-REL-016
- `promptBooster.mcp.probeServers` gets `scope: "machine"`, so a workspace settings file cannot set it. Its description says that the probe runs only from the `Refresh MCP Tool Index` command. Refs: REQ-REL-016, REQ-PROBE-001
- The manifest `description` starts with `Legacy (Local harness only):`. `displayName`, `name`, `publisher`, and `version` do not change. Refs: REQ-REL-016
- The CHANGELOG `Unreleased` entry states the freeze, the reason, and the two manifest changes. The rule "newest release entry equals the version" ignores `Unreleased`. Refs: REQ-REL-002
- `AGENTS.md` keeps the rule "do not import `vscode` in `src/core`" as a rule for new code and says that seven files break it. It drops the Meta-MCP line and the word "intercepts", and it states the freeze. Refs: REQ-REL-017
- CI has one job on `ubuntu-latest` with Node 22: `npm ci`, `npm run compile`, `npm run lint`, `specctx check --strict`, `openspec validate --all --strict`. A second step runs `xvfb-run -a npm test` with `continue-on-error: true`. Refs: REQ-REL-004

## Risks / Trade-offs

- `supported: false` removes the extension from untrusted folders for its last users. Mitigation: one click on "Trust" brings it back, and the CHANGELOG says so.
- The README names a plugin that is not there yet. Mitigation: it says "in progress" and links ADR-004. Change 003 adds the install command, and change 004 adds the claim.
- A non-blocking test step can rot. Mitigation: it tests frozen code, and the step still shows red in the run.
- The fingerprint issue stays in the code. Mitigation: the README states it, and the parked change holds the fix.
