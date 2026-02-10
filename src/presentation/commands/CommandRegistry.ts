/**
 * Command Registry - Centralized command registration
 * Resolves all commands from DI container and registers them
 */
import * as vscode from "vscode";
import { Container } from "../../di/Container";
import { TYPES } from "../../di/types";
import { BoostCommand } from "./BoostCommand";
import { ProcessFileCommand } from "./ProcessFileCommand";
import { SwitchModeCommand } from "./SwitchModeCommand";
import { SwitchModelCommand } from "./SwitchModelCommand";
import { ChatCommandsHandler } from "./ChatCommands";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";

export class CommandRegistry {
  constructor(private container: Container) {}

  /**
   * Register all commands in the extension
   */
  registerAll(context: vscode.ExtensionContext): void {
    // Resolve dependencies
    const logger = this.container.resolve<ILogger>(TYPES.Logger);

    // Register core commands
    this.registerBoostCommand(context);
    this.registerProcessFileCommand(context);
    this.registerSwitchModeCommand(context);
    this.registerChatCommands(context);
    this.registerUtilityCommands(context);

    logger.log("All commands registered successfully");
  }

  private registerBoostCommand(context: vscode.ExtensionContext): void {
    const command = this.container.resolve<BoostCommand>(TYPES.BoostCommand);
    command.register(context);
  }

  private registerProcessFileCommand(context: vscode.ExtensionContext): void {
    const command = this.container.resolve<ProcessFileCommand>(
      TYPES.ProcessFileCommand,
    );
    command.register(context);
  }

  private registerSwitchModeCommand(context: vscode.ExtensionContext): void {
    const command = this.container.resolve<SwitchModeCommand>(
      TYPES.SwitchModeCommand,
    );
    command.register(context);
  }

  private registerChatCommands(context: vscode.ExtensionContext): void {
    const handler = this.container.resolve<ChatCommandsHandler>(
      TYPES.ChatCommandsHandler,
    );
    handler.register(context);
  }

  private registerUtilityCommands(context: vscode.ExtensionContext): void {
    const logger = this.container.resolve<ILogger>(TYPES.Logger);
    const configManager = this.container.resolve<IConfigurationManager>(
      TYPES.ConfigurationManager,
    );

    // Toggle Auto-Optimize
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "promptBooster.toggleAutoOptimization",
        async () => {
          await configManager.toggleAutoOptimize();
          const enabled = configManager.isAutoOptimizeEnabled();
          vscode.window.showInformationMessage(
            `Auto-optimization ${enabled ? "enabled" : "disabled"}`,
          );
          logger.log(`Auto-optimize toggled: ${enabled}`);
        },
      ),
    );

    // Switch Model Command
    const switchModelCommand = this.container.resolve<SwitchModelCommand>(
      TYPES.SwitchModelCommand,
    );
    switchModelCommand.register(context);

    // Configure Permissions - delegates to VS Code settings UI
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "promptBooster.configurePermissions",
        () => {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "promptBooster",
          );
        },
      ),
    );
  }
}
