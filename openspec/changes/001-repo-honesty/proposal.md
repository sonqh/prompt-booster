# Proposal

## Why

On 2026-11-18 VS Code showed this banner on `@PromptBooster`: "Chat participants are deprecated and are not supported by the Copilot harness." The first-party pages confirm it (ADR-004 holds the links). The chat participant runs only on the Local harness, and VS Code removes that harness in February 2027. The headline feature of the extension has an end date.

ADR-004 answers with a new direction: the product becomes one agent plugin with one skill, and the extension is frozen and never goes to a store. The repository does not say any of this yet. Its README still opens with `@PromptBooster`, claims "automatic prompt interception", and says that `src/core` never imports `vscode`. `AGENTS.md` repeats the core claim and says that the Meta-MCP design drives current work. The LICENSE file has two lines and no MIT grant. The CHANGELOG stops at 0.2.2. No CI runs.

The frozen extension also has two known safety gaps: it activates in an untrusted workspace, and a workspace settings file can turn the MCP probe on. The full fix is parked with the engine. Two manifest lines close the worst of it now.

## What Changes

- LICENSE holds the full MIT text.
- The first screen of the README says what the repository is now: a plugin first, and a legacy extension that works on the Local harness until February 2027, with the VS Code documentation link. It no longer presents `@PromptBooster` as the main entry.
- The README drops the claims "automatic prompt interception" and "core never imports vscode", and it lists the known open issues of the frozen extension.
- CHANGELOG gains 0.2.3 and 0.2.4, and an `Unreleased` note on the freeze.
- The manifest declares that the extension does not run in an untrusted workspace, gives `promptBooster.mcp.probeServers` the scope `machine`, and marks the extension as legacy in its description.
- `AGENTS.md` loses its false lines.
- A small CI workflow runs compile, lint, and the spec gates. The Electron test suite runs and does not block.

Out of scope: every code change under `src/`, the release checks and the dependency clean-up of the old plan (parked as `openspec/parked/release-hygiene`), a version bump, a store release.

## Capabilities

### New Capabilities
- `release-and-packaging`: the rules that keep the repository text, the license, the changelog, the manifest, and CI true.

### Modified Capabilities

None.

## Impact

- Changed: `LICENSE`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `package.json` (`description`, `capabilities`, the scope and description of one setting; not the version).
- New: `.github/workflows/ci.yml`.
- No file under `src/` changes. The main specs stay true.
- A user who opens an untrusted folder no longer gets the extension there until the folder is trusted.
