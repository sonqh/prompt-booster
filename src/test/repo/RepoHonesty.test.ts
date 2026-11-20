/**
 * Tests for the repository files of change 001-repo-honesty.
 *
 * They read files at the repository root with Node only. No VS Code API.
 * Two scenarios describe host behavior (GitHub Actions, VS Code workspace
 * trust). These tests check the file content that causes that behavior.
 * They do not run the host.
 */
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

// out/test/repo -> repository root
const root = path.resolve(__dirname, "../../..");
const read = (file: string): string =>
  fs.readFileSync(path.join(root, file), "utf8");
const firstScreen = (text: string): string =>
  text.split("\n").slice(0, 30).join("\n");

suite("Repository honesty (change 001)", () => {
  // Covers: REQ-REL-001
  // SCN-REL-001-1
  test("LICENSE holds the MIT grant and the warranty disclaimer", () => {
    const license = read("LICENSE");
    assert.ok(license.includes("Permission is hereby granted, free of charge"));
    assert.ok(license.includes("WITHOUT WARRANTY OF ANY KIND"));
    assert.ok(license.includes("Copyright (c) 2026 Son Quach"));
    assert.ok(license.includes("The above copyright notice and this permission notice shall be included"));
  });

  // Covers: REQ-REL-002
  // SCN-REL-002-1
  test("CHANGELOG has the manifest version as its newest release entry", () => {
    const changelog = read("CHANGELOG.md");
    const version = JSON.parse(read("package.json")).version as string;
    const releases = changelog
      .split("\n")
      .filter((line) => /^## \[\d/.test(line))
      .map((line) => line.replace(/^## \[([^\]]*)\].*$/, "$1"));
    assert.strictEqual(releases[0], version);
    const i024 = releases.indexOf("0.2.4");
    const i023 = releases.indexOf("0.2.3");
    const i022 = releases.indexOf("0.2.2");
    assert.ok(i024 >= 0 && i024 < i023 && i023 < i022, "0.2.4, 0.2.3, 0.2.2 in order");
  });

  // Covers: REQ-REL-002
  // SCN-REL-002-2
  test("the Unreleased entry names the freeze and the chat participant deprecation", () => {
    const changelog = read("CHANGELOG.md");
    const start = changelog.indexOf("## [Unreleased]");
    assert.ok(start >= 0, "Unreleased heading");
    const end = changelog.indexOf("\n## [", start + 1);
    const entry = changelog.slice(start, end);
    assert.ok(start < changelog.indexOf("## [0.2.4]"), "Unreleased is above 0.2.4");
    assert.ok(/frozen/i.test(entry));
    assert.ok(/deprecated chat participants/i.test(entry));
  });

  // Covers: REQ-REL-004
  // SCN-REL-004-1
  test("the CI workflow has the blocking steps on push and pull request", () => {
    const ci = read(".github/workflows/ci.yml");
    assert.ok(ci.includes("pull_request"));
    assert.ok(/^\s*push:/m.test(ci));
    for (const step of [
      "npm ci",
      "npm run compile",
      "npm run lint",
      "check --strict",
      "validate --all --strict",
    ]) {
      const line = ci.split("\n").findIndex((l) => l.includes(step));
      assert.ok(line >= 0, `step: ${step}`);
    }
    // Only one step is allowed to fail.
    assert.strictEqual((ci.match(/continue-on-error/g) ?? []).length, 1);
  });

  // Covers: REQ-REL-004
  // SCN-REL-004-2
  test("the Electron test step of the CI workflow does not block", () => {
    const lines = read(".github/workflows/ci.yml").split("\n");
    const flag = lines.findIndex((l) => l.includes("continue-on-error: true"));
    assert.ok(flag >= 0, "continue-on-error: true");
    const step = lines.slice(flag - 2, flag + 3).join("\n");
    assert.ok(step.includes("npm test"), "the flag is on the npm test step");
  });

  // Covers: REQ-REL-005
  // SCN-REL-005-1
  test("the first 30 lines of the README state the status", () => {
    const top = firstScreen(read("README.md"));
    assert.ok(top.includes("Legacy"));
    assert.ok(top.includes("February 2027"));
    assert.ok(top.includes("https://code.visualstudio.com/api/extension-guides/ai/chat"));
    assert.ok(top.includes("decisions/ADR-004-plugin-first.md"));
    assert.ok(!top.includes("@PromptBooster"));
  });

  // Covers: REQ-REL-005
  // SCN-REL-005-2
  test("the README has no interception claim and no core import claim", () => {
    const readme = read("README.md");
    assert.ok(!/automatic prompt interception/i.test(readme));
    assert.ok(!readme.includes("never imports"));
  });

  // Covers: REQ-REL-005
  // SCN-REL-005-3
  test("the legacy section of the README lists the known issues", () => {
    const readme = read("README.md");
    const legacy = readme.slice(readme.search(/^## .*Legacy VS Code extension/m));
    assert.ok(legacy.includes("Known issues"));
    assert.ok(/fingerprint/i.test(legacy));
    assert.ok(legacy.includes("`env` values"));
    assert.ok(/workspace state/i.test(legacy));
    assert.ok(/no workspace trust check in code/i.test(legacy));
    assert.ok(/off by default/i.test(legacy));
  });

  // Covers: REQ-REL-016
  // SCN-REL-016-1
  test("the manifest does not support untrusted workspaces", () => {
    const manifest = JSON.parse(read("package.json"));
    assert.strictEqual(manifest.capabilities.untrustedWorkspaces.supported, false);
    assert.strictEqual(manifest.version, "0.2.4");
  });

  // Covers: REQ-REL-016
  // SCN-REL-016-2
  test("the probe setting has the machine scope and a manual-only description", () => {
    const manifest = JSON.parse(read("package.json"));
    const setting =
      manifest.contributes.configuration.properties["promptBooster.mcp.probeServers"];
    assert.strictEqual(setting.scope, "machine");
    assert.strictEqual(setting.default, false);
    assert.ok(!/activation|config change/i.test(setting.description));
    assert.ok(setting.description.includes("Refresh MCP Tool Index"));
  });

  // Covers: REQ-REL-016
  // SCN-REL-016-3
  test("the manifest description starts with the legacy label", () => {
    const manifest = JSON.parse(read("package.json"));
    assert.ok(manifest.description.startsWith("Legacy (Local harness only)"));
  });

  // Covers: REQ-REL-017
  // SCN-REL-017-1
  test("AGENTS.md has no Meta-MCP driver line and no intercepts claim", () => {
    const agents = read("AGENTS.md");
    assert.ok(!agents.includes("driving current work"));
    assert.ok(!/intercepts/i.test(agents));
  });

  // Covers: REQ-REL-017
  // SCN-REL-017-2
  test("AGENTS.md states the freeze, the plugin, and the seven core files", () => {
    const agents = read("AGENTS.md");
    const overview = agents.slice(
      agents.indexOf("## Project Overview"),
      agents.indexOf("## Folder Structure"),
    );
    assert.ok(/frozen/i.test(overview));
    assert.ok(overview.includes("/prompt-booster:boost"));
    assert.ok(/New work goes to the plugin/.test(overview));
    assert.ok(/Seven files in `src\/core` break this rule/.test(agents));
    assert.ok(agents.includes("Specs and workflow"));
  });
});
