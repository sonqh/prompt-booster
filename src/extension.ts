/**
 * PromptBooster VS Code Extension
 * Main entry point
 */

import * as vscode from "vscode";
import * as path from "path";
import { ModeManager } from "./config/settings";
import { ModeStatusBar } from "./ui/modeSelector";
import { LanguageModelSelector } from "./models/languageModels";
import { PromptOptimizer } from "./promptBooster";
import { ManualMode } from "./modes/manualMode";
import { FileMode } from "./modes/fileMode";
import { RealtimeMode } from "./modes/realtimeMode";
import { PreviewPanel } from "./ui/previewPanel";
import { ProcessButton, PromptFileCodeLensProvider } from "./ui/processButton";

let outputChannel: vscode.OutputChannel;
let modeManager: ModeManager;
let statusBar: ModeStatusBar;
let processButton: ProcessButton;

export function activate(context: vscode.ExtensionContext) {
  console.log("PromptBooster extension is now active");

  // Initialize output channel
  outputChannel = vscode.window.createOutputChannel("PromptBooster");
  outputChannel.appendLine("PromptBooster extension activated");
  context.subscriptions.push(outputChannel);

  // Initialize core components
  modeManager = new ModeManager(context);
  const modelSelector = new LanguageModelSelector(outputChannel);
  const optimizer = new PromptOptimizer(outputChannel);

  // Initialize UI components
  statusBar = new ModeStatusBar(modeManager);
  context.subscriptions.push(statusBar);

  processButton = new ProcessButton();
  context.subscriptions.push(processButton);

  // Initialize mode handlers
  const manualMode = new ManualMode(optimizer, modelSelector, outputChannel);
  const fileMode = new FileMode(outputChannel);

  // Register commands
  const boostCommand = vscode.commands.registerCommand(
    "promptBooster.boost",
    (uri?: vscode.Uri) => manualMode.boost(uri),
  );
  context.subscriptions.push(boostCommand);

  const switchModeCommand = vscode.commands.registerCommand(
    "promptBooster.switchMode",
    () => statusBar.showModeSwitcher(),
  );
  context.subscriptions.push(switchModeCommand);

  const toggleAutoOptimizeCommand = vscode.commands.registerCommand(
    "promptBooster.toggleAutoOptimization",
    async () => {
      await modeManager.toggleAutoOptimize();
      const enabled = modeManager.isAutoOptimizeEnabled();
      vscode.window.showInformationMessage(
        `Auto-optimization ${enabled ? "enabled" : "disabled"}`,
      );
    },
  );
  context.subscriptions.push(toggleAutoOptimizeCommand);

  const switchModelCommand = vscode.commands.registerCommand(
    "promptBooster.switchModel",
    async () => {
      const model = await modelSelector.selectModel(true); // Force show picker
      if (model) {
        vscode.window.showInformationMessage(
          `Switched to model: ${model.name}`,
        );
      }
    },
  );
  context.subscriptions.push(switchModelCommand);

  const configurePermissionsCommand = vscode.commands.registerCommand(
    "promptBooster.configurePermissions",
    () => modeManager.configurePermissions(),
  );
  context.subscriptions.push(configurePermissionsCommand);

  const processPromptFileCommand = vscode.commands.registerCommand(
    "promptBooster.processPromptFile",
    async (document?: vscode.TextDocument) => {
      const doc = document || vscode.window.activeTextEditor?.document;
      if (doc) {
        await fileMode.processPromptFile(doc);
      } else {
        vscode.window.showWarningMessage("No prompt file open");
      }
    },
  );
  context.subscriptions.push(processPromptFileCommand);

  // Add test command for file generation
  const testFileGenerationCommand = vscode.commands.registerCommand(
    "promptBooster.testFileGeneration",
    async () => {
      // Check if workspace folder is open
      if (!vscode.workspace.workspaceFolders?.length) {
        vscode.window.showErrorMessage(
          "Please open a workspace folder to test file generation",
        );
        return;
      }

      const testOriginal = "Create a REST API for managing users";
      const model = await modelSelector.selectModel();
      if (!model) {
        vscode.window.showErrorMessage("No language model available");
        return;
      }

      try {
        vscode.window.showInformationMessage(`Using model: ${model.name}`);
        const optimized = await optimizer.optimizeWithProgress(
          testOriginal,
          model,
          "Generating test file...",
        );

        if (optimized) {
          const filePath = await fileMode.generatePromptFile(
            testOriginal,
            optimized,
          );
          if (filePath) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage(
              `Test file created: ${path.basename(filePath)}`,
            );
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate test file: ${error instanceof Error ? error.message : String(error)}`,
        );
        outputChannel.appendLine(`Test file generation error: ${error}`);
      }
    },
  );
  context.subscriptions.push(testFileGenerationCommand);

  // Register CodeLens provider for .prompt.md files
  const codeLensProvider = new PromptFileCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { pattern: "**/*.prompt.md" },
    codeLensProvider,
  );
  context.subscriptions.push(codeLensDisposable);

  // Log current mode
  outputChannel.appendLine(`Current mode: ${modeManager.getMode()}`);
  outputChannel.appendLine(
    `Auto-optimize: ${modeManager.isAutoOptimizeEnabled()}`,
  );

  // Show welcome message on first activation
  const hasShownWelcome = context.globalState.get<boolean>("hasShownWelcome");
  if (!hasShownWelcome) {
    vscode.window
      .showInformationMessage(
        "PromptBooster is now active! Right-click any .prompt.md file to boost it.",
        "Got it",
      )
      .then(() => {
        context.globalState.update("hasShownWelcome", true);
      });
  }

  // Register chat participant for real-time mode
  try {
    const previewPanel = new PreviewPanel();
    const realtimeMode = new RealtimeMode(
      modeManager,
      optimizer,
      modelSelector,
      previewPanel,
      outputChannel,
    );

    const participant = vscode.chat.createChatParticipant(
      "promptBooster.interceptor",
      async (request, context, stream, token) => {
        await realtimeMode.handleChatRequest(request, context, stream, token);
      },
    );

    // Configure participant
    participant.iconPath = vscode.Uri.file(
      path.join(context.extensionPath, "resources", "icon.png"),
    );
    // participant.isSticky = true; // Not available in current API version

    context.subscriptions.push(participant);
    outputChannel.appendLine("Chat participant registered successfully");
  } catch (error) {
    outputChannel.appendLine(
      `Failed to register chat participant: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Don't fail activation if chat participant registration fails
    // This allows the extension to work in older VS Code versions
  }

  // Add test command for real-time mode
  const testRealtimeModeCommand = vscode.commands.registerCommand(
    "promptBooster.testRealtimeMode",
    async () => {
      try {
        const testPrompt = "Write a function to calculate factorial";

        vscode.window.showInformationMessage(
          `Testing realtime mode with prompt: "${testPrompt}"`,
        );

        outputChannel.appendLine("=== Test Realtime Mode ===");
        outputChannel.appendLine(`Test prompt: ${testPrompt}`);

        // Check mode and settings
        const mode = modeManager.getMode();
        const autoOptimize = modeManager.isAutoOptimizeEnabled();
        const showPreview = modeManager.isShowPreviewEnabled();

        outputChannel.appendLine(`Current mode: ${mode}`);
        outputChannel.appendLine(`Auto-optimize: ${autoOptimize}`);
        outputChannel.appendLine(`Show preview: ${showPreview}`);

        if (mode !== "realtime") {
          vscode.window.showWarningMessage(
            `PromptBooster is in ${mode} mode. Switch to realtime mode to test.`,
          );
          return;
        }

        if (!autoOptimize) {
          vscode.window.showWarningMessage(
            "Auto-optimization is disabled. Enable it to test realtime mode.",
          );
          return;
        }

        // Select model
        const model = await modelSelector.selectModel();
        if (!model) {
          vscode.window.showErrorMessage("No language model available");
          return;
        }

        // Optimize
        const optimized = await optimizer.optimizeWithProgress(
          testPrompt,
          model,
          "Testing optimization...",
        );

        if (!optimized) {
          vscode.window.showInformationMessage("Test cancelled");
          return;
        }

        outputChannel.appendLine("=== Optimized Prompt ===");
        outputChannel.appendLine(optimized);

        // Show preview
        if (showPreview) {
          const previewPanel = new PreviewPanel();
          const result = await previewPanel.showInlinePreview(
            testPrompt,
            optimized,
          );

          if (result) {
            outputChannel.appendLine(`User action: ${result.action}`);
            outputChannel.appendLine(`Final prompt: ${result.prompt}`);
            vscode.window.showInformationMessage(
              "✓ Test completed successfully!",
            );
          } else {
            vscode.window.showInformationMessage("Test cancelled by user");
          }
        } else {
          vscode.window.showInformationMessage(
            "✓ Test completed (preview disabled)",
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Test failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        outputChannel.appendLine(`Test error: ${error}`);
      }
    },
  );
  context.subscriptions.push(testRealtimeModeCommand);
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine("PromptBooster extension deactivated");
  }
  if (modeManager) {
    modeManager.dispose();
  }
}
