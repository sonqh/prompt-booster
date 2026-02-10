/**
 * Service Registry - registers all services in the DI container
 */
import * as vscode from "vscode";
import { Container } from "./Container";
import { TYPES } from "./types";

// Infrastructure
import { VSCodeOutputLogger } from "../infrastructure/vscode/VSCodeOutputLogger";
import { VSCodeFileSystem } from "../infrastructure/vscode/VSCodeFileSystem";
import { VSCodeProgressService } from "../infrastructure/vscode/VSCodeProgressService";
import { ConfigurationManager } from "../infrastructure/config/ConfigurationManager";
import { StateRepository } from "../infrastructure/state/StateRepository";
import { LanguageModelProvider } from "../infrastructure/vscode/LanguageModelProvider";

// Core Services
import { PromptOptimizationService } from "../core/services/PromptOptimizationService";

// Strategies
import { ManualModeStrategy } from "../core/strategies/ManualModeStrategy";
import { RealtimeModeStrategy } from "../core/strategies/RealtimeModeStrategy";
import { FileModeStrategy } from "../core/strategies/FileModeStrategy";

// Presentation - Commands
import { CommandRegistry } from "../presentation/commands/CommandRegistry";
import { BoostCommand } from "../presentation/commands/BoostCommand";
import { ProcessFileCommand } from "../presentation/commands/ProcessFileCommand";
import { SwitchModeCommand } from "../presentation/commands/SwitchModeCommand";
import { ChatCommandsHandler } from "../presentation/commands/ChatCommands";

// Presentation - UI & Participants
import { ChatParticipantHandler } from "../presentation/participants/ChatParticipantHandler";
import { StatusBarController } from "../presentation/ui/StatusBarController";

// Interfaces
import { ILogger } from "../shared/interfaces/ILogger";
import { IConfigurationManager } from "../shared/interfaces/IConfigurationManager";
import { IFileSystem } from "../shared/interfaces/IFileSystem";
import { IProgressService } from "../shared/interfaces/IProgressReporter";
import { IPromptOptimizationService } from "../core/services/IPromptOptimizationService";
import { ILanguageModelProvider } from "../core/models/ILanguageModelProvider";
import { IModeStrategy } from "../core/strategies/IModeStrategy";

export class ServiceRegistry {
  /**
   * Register all services in the container
   */
  static registerServices(
    container: Container,
    context: vscode.ExtensionContext,
  ): void {
    // Register VS Code context as a constant
    container.registerConstant(TYPES.ExtensionContext, context);

    // Infrastructure
    this.registerInfrastructure(container);

    // Core Services
    this.registerCoreServices(container);

    // Strategies
    this.registerStrategies(container);

    // Presentation Layer
    this.registerPresentationLayer(container);
  }

  /**
   * Register infrastructure layer services
   */
  private static registerInfrastructure(container: Container): void {
    container.registerSingleton(TYPES.Logger, () => {
      return new VSCodeOutputLogger("PromptBooster");
    });

    container.registerSingleton(TYPES.ConfigurationManager, (c) => {
      const context = c.resolve<vscode.ExtensionContext>(
        TYPES.ExtensionContext,
      );
      return new ConfigurationManager(context);
    });

    container.registerSingleton(TYPES.FileSystem, () => {
      return new VSCodeFileSystem();
    });

    container.registerSingleton(TYPES.ProgressService, () => {
      return new VSCodeProgressService();
    });

    container.registerSingleton(TYPES.StateRepository, (c) => {
      const context = c.resolve<vscode.ExtensionContext>(
        TYPES.ExtensionContext,
      );
      return new StateRepository(context);
    });

    container.registerSingleton(TYPES.LanguageModelProvider, (c) => {
      const config = c.resolve<IConfigurationManager>(
        TYPES.ConfigurationManager,
      );
      const logger = c.resolve<ILogger>(TYPES.Logger);
      return new LanguageModelProvider(config, logger);
    });
  }

  /**
   * Register core domain services
   */
  private static registerCoreServices(container: Container): void {
    container.registerSingleton(TYPES.PromptOptimizationService, (c) => {
      const logger = c.resolve<ILogger>(TYPES.Logger);
      return new PromptOptimizationService(logger);
    });
  }

  /**
   * Register mode strategies
   */
  private static registerStrategies(container: Container): void {
    container.registerSingleton(TYPES.ManualModeStrategy, (c) => {
      return new ManualModeStrategy(
        c.resolve<IPromptOptimizationService>(TYPES.PromptOptimizationService),
        c.resolve<ILanguageModelProvider>(TYPES.LanguageModelProvider),
        c.resolve<IProgressService>(TYPES.ProgressService),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.RealtimeModeStrategy, (c) => {
      return new RealtimeModeStrategy(
        c.resolve<IPromptOptimizationService>(TYPES.PromptOptimizationService),
        c.resolve<ILanguageModelProvider>(TYPES.LanguageModelProvider),
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.FileModeStrategy, (c) => {
      return new FileModeStrategy(
        c.resolve<IPromptOptimizationService>(TYPES.PromptOptimizationService),
        c.resolve<ILanguageModelProvider>(TYPES.LanguageModelProvider),
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
        c.resolve<IFileSystem>(TYPES.FileSystem),
        c.resolve<IProgressService>(TYPES.ProgressService),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });
  }

  /**
   * Register presentation layer (commands, UI)
   */
  private static registerPresentationLayer(container: Container): void {
    // Command Registry
    container.registerSingleton(TYPES.CommandRegistry, (c) => {
      return new CommandRegistry(c);
    });

    // Commands
    container.registerSingleton(TYPES.BoostCommand, (c) => {
      return new BoostCommand(
        c.resolve<IModeStrategy>(TYPES.ManualModeStrategy),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.ProcessFileCommand, (c) => {
      return new ProcessFileCommand(
        c.resolve<FileModeStrategy>(TYPES.FileModeStrategy),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.SwitchModeCommand, (c) => {
      return new SwitchModeCommand(
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.ChatCommandsHandler, (c) => {
      return new ChatCommandsHandler(
        c.resolve<FileModeStrategy>(TYPES.FileModeStrategy),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    // UI Components
    container.registerSingleton(TYPES.StatusBarController, (c) => {
      return new StatusBarController(
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    // Chat Participant
    container.registerSingleton(TYPES.ChatParticipantHandler, (c) => {
      return new ChatParticipantHandler(c);
    });
  }
}
