/**
 * PromptBooster VS Code Extension - Refactored Entry Point
 * Uses dependency injection and clean architecture
 */
import * as vscode from "vscode";
import { Container } from "./di/Container";
import { ServiceRegistry } from "./di/ServiceRegistry";
import { TYPES } from "./di/types";
import { CommandRegistry } from "./presentation/commands/CommandRegistry";
import { ILogger } from "./shared/interfaces/ILogger";
import { IConfigurationManager } from "./shared/interfaces/IConfigurationManager";

export function activate(context: vscode.ExtensionContext) {
  console.log("PromptBooster extension is now active");

  // Step 1: Create and configure DI container
  const container = new Container();
  ServiceRegistry.registerServices(container, context);

  // Step 2: Resolve logger for initialization logging
  const logger = container.resolve<ILogger>(TYPES.Logger);
  const configManager = container.resolve<IConfigurationManager>(
    TYPES.ConfigurationManager,
  );

  logger.log("PromptBooster extension activated");
  logger.log(`Current mode: ${configManager.getOperationMode()}`);
  logger.log(`Auto-optimize: ${configManager.isAutoOptimizeEnabled()}`);

  // Step 3: Register all commands via CommandRegistry
  const commandRegistry = container.resolve<CommandRegistry>(
    TYPES.CommandRegistry,
  );
  commandRegistry.registerAll(context);

  // Step 4: Register UI components (status bar, code lens, etc.)
  registerUIComponents(context, container);

  // Step 5: Register chat participant for realtime mode
  registerChatParticipant(context, container);

  // Step 6: Show welcome message on first activation
  showWelcomeMessage(context);

  logger.log("PromptBooster extension fully initialized");
}

export function deactivate() {
  console.log("PromptBooster extension deactivated");
}

/**
 * Register UI components (status bar, code lens providers, etc.)
 */
function registerUIComponents(
  context: vscode.ExtensionContext,
  container: Container,
): void {
  const logger = container.resolve<ILogger>(TYPES.Logger);

  // Register Status Bar
  const statusBar = container.resolve<any>(TYPES.StatusBarController);
  context.subscriptions.push(statusBar);
  logger.log("Status bar registered");

  // Register CodeLens provider for .prompt.md files
  const {
    PromptFileCodeLensProvider,
  } = require("./presentation/ui/ProcessButton");
  const codeLensProvider = new PromptFileCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { pattern: "**/*.prompt.md" },
    codeLensProvider,
  );
  context.subscriptions.push(codeLensDisposable);
  logger.log("CodeLens provider registered");
}

/**
 * Register chat participant for realtime mode
 */
function registerChatParticipant(
  context: vscode.ExtensionContext,
  container: Container,
): void {
  const chatParticipantHandler = container.resolve<any>(
    TYPES.ChatParticipantHandler,
  );
  chatParticipantHandler.register(context);
}

/**
 * Show welcome message on first activation
 */
function showWelcomeMessage(context: vscode.ExtensionContext): void {
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
}
