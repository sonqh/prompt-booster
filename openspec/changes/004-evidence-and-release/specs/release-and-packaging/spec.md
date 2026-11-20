# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-REL-005 User-facing text states real behavior
The first 30 lines of the README SHALL hold the plugin text that the A/B record allows, the install command, and a link to the record. They SHALL call the VS Code extension legacy, give February 2027 as the end of the Local harness, link the VS Code page on chat participants, and not name `@PromptBooster`. The README SHALL not say that prompts are intercepted or that `src/core` never imports `vscode`. Its legacy section SHALL list the known issues.

Refs: REQ-CHAT-001, REQ-SKILL-013, ADR-004

#### Scenario: SCN-REL-005-1 The first screen
- **WHEN** a visitor reads the first 30 lines of the README
- **THEN** they hold `/prompt-booster:boost`, `Legacy`, `February 2027`, and `https://code.visualstudio.com/api/extension-guides/ai/chat`, and they do not hold `@PromptBooster`

#### Scenario: SCN-REL-005-2 The interception claim
- **WHEN** a reader searches the README for `Automatic prompt interception` and for `never imports`
- **THEN** neither text is there

#### Scenario: SCN-REL-005-3 The known issues
- **WHEN** a reader opens the legacy section
- **THEN** it says that the catalog fingerprint in workspace state can hold `env` values of MCP settings, that the probe has no workspace-trust check in code, and that the probe is off by default
