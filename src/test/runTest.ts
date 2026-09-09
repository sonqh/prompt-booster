import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Download VS Code, unzip it and run the integration test.
    // Version pinned: @vscode/test-electron@2.5.2 hardcodes the macOS binary as
    // Contents/MacOS/Electron, which VS Code zips newer than ~1.109 renamed to
    // "Code" (spawn fails with ENOENT against "latest"). 1.109.0 still ships
    // "Electron" and satisfies engines.vscode ^1.99.0.
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      version: "1.109.0",
    });
  } catch (err) {
    console.error("Failed to run tests");
    process.exit(1);
  }
}

main();
