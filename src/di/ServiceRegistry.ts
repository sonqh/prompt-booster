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
import { VSCodeMcpEnvironmentProvider } from "../infrastructure/vscode/VSCodeMcpEnvironmentProvider";
import { VSCodeMcpRuntimeToolsProvider } from "../infrastructure/vscode/VSCodeMcpRuntimeToolsProvider";
import { VSCodeConfigWatcher } from "../infrastructure/vscode/VSCodeConfigWatcher";
import { ChildProcessMcpTransport } from "../infrastructure/mcp/ChildProcessMcpTransport";

// Core Services
import { PromptOptimizationService } from "../core/services/PromptOptimizationService";
import { WorkspaceContextGatherer } from "../core/services/WorkspaceContextGatherer";
import { ReferenceResolver } from "../core/services/ReferenceResolver";
import { MCPToolRegistry } from "../core/services/MCPToolRegistry";
import { McpToolIndexStore } from "../core/services/McpToolIndexStore";
import { McpServerProbe } from "../core/services/McpServerProbe";
import { PromptFeedbackLog } from "../core/services/PromptFeedbackLog";
import { PromptResponseCache } from "../core/services/PromptResponseCache";
import { PromptLearningStore } from "../core/services/PromptLearningStore";

// Strategies
import { ManualModeStrategy } from "../core/strategies/ManualModeStrategy";
import { RealtimeModeStrategy } from "../core/strategies/RealtimeModeStrategy";
import { FileModeStrategy } from "../core/strategies/FileModeStrategy";

// Presentation - Commands
import { CommandRegistry } from "../presentation/commands/CommandRegistry";
import { BoostCommand } from "../presentation/commands/BoostCommand";
import { ProcessFileCommand } from "../presentation/commands/ProcessFileCommand";
import { SwitchModeCommand } from "../presentation/commands/SwitchModeCommand";
import { SwitchModelCommand } from "../presentation/commands/SwitchModelCommand";
import { ChatCommandsHandler } from "../presentation/commands/ChatCommands";
import { RefreshMcpIndexCommand } from "../presentation/commands/RefreshMcpIndexCommand";
import { UsePromptVersionCommand } from "../presentation/commands/UsePromptVersionCommand";
import { ShowFeedbackReportCommand } from "../presentation/commands/ShowFeedbackReportCommand";
import { ExportMcpGoldenCandidatesCommand } from "../presentation/commands/ExportMcpGoldenCandidatesCommand";

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
import { IMcpEnvironmentProvider } from "../shared/interfaces/IMcpEnvironmentProvider";
import { IMcpRuntimeToolsProvider } from "../shared/interfaces/IMcpRuntimeToolsProvider";
import { IMcpProcessTransport } from "../shared/interfaces/IMcpProcessTransport";
import { IConfigChangeWatcher } from "../shared/interfaces/IConfigChangeWatcher";
import { IStateRepository } from "../infrastructure/state/StateRepository";
import { IMcpToolIndexStore } from "../core/services/IMcpToolIndexStore";
import { IMcpServerProbe } from "../core/services/IMcpServerProbe";

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

    // MCP adapters (Enhancement 4 v2) — registry consumes these through ports
    container.registerSingleton(TYPES.McpEnvironmentProvider, () => {
      return new VSCodeMcpEnvironmentProvider();
    });

    container.registerSingleton(TYPES.McpRuntimeToolsProvider, (c) => {
      return new VSCodeMcpRuntimeToolsProvider(c.resolve<ILogger>(TYPES.Logger));
    });

    container.registerSingleton(TYPES.ConfigChangeWatcher, () => {
      return new VSCodeConfigWatcher();
    });

    container.registerSingleton(TYPES.McpProcessTransport, (c) => {
      return new ChildProcessMcpTransport(c.resolve<ILogger>(TYPES.Logger));
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

    container.registerSingleton(TYPES.WorkspaceContextGatherer, (c) => {
      return new WorkspaceContextGatherer(
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.ReferenceResolver, (c) => {
      return new ReferenceResolver(
        c.resolve<IFileSystem>(TYPES.FileSystem),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.McpToolIndexStore, (c) => {
      return new McpToolIndexStore(
        c.resolve<IFileSystem>(TYPES.FileSystem),
        c.resolve<IStateRepository>(TYPES.StateRepository),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.McpServerProbe, (c) => {
      return new McpServerProbe(
        c.resolve<IMcpProcessTransport>(TYPES.McpProcessTransport),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.MCPToolRegistry, (c) => {
      return new MCPToolRegistry(
        c.resolve<IFileSystem>(TYPES.FileSystem),
        c.resolve<ILogger>(TYPES.Logger),
        c.resolve<IMcpEnvironmentProvider>(TYPES.McpEnvironmentProvider),
        c.resolve<IMcpRuntimeToolsProvider>(TYPES.McpRuntimeToolsProvider),
        c.resolve<IMcpToolIndexStore>(TYPES.McpToolIndexStore),
        c.resolve<IConfigChangeWatcher>(TYPES.ConfigChangeWatcher),
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
      );
    });

    container.registerSingleton(TYPES.PromptFeedbackLog, (c) => {
      return new PromptFeedbackLog(
        c.resolve<IStateRepository>(TYPES.StateRepository),
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.PromptResponseCache, (c) => {
      return new PromptResponseCache(
        c.resolve<IStateRepository>(TYPES.StateRepository),
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.PromptLearningStore, (c) => {
      return new PromptLearningStore(
        c.resolve<PromptFeedbackLog>(TYPES.PromptFeedbackLog),
        c.resolve<ILogger>(TYPES.Logger),
      );
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
        c.resolve<WorkspaceContextGatherer>(TYPES.WorkspaceContextGatherer),
        c.resolve<ReferenceResolver>(TYPES.ReferenceResolver),
        c.resolve<MCPToolRegistry>(TYPES.MCPToolRegistry),
        c.resolve<PromptFeedbackLog>(TYPES.PromptFeedbackLog),
        c.resolve<PromptResponseCache>(TYPES.PromptResponseCache),
        c.resolve<PromptLearningStore>(TYPES.PromptLearningStore),
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

    container.registerSingleton(TYPES.SwitchModelCommand, (c) => {
      return new SwitchModelCommand(
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.ChatCommandsHandler, (c) => {
      return new ChatCommandsHandler(
        c.resolve<FileModeStrategy>(TYPES.FileModeStrategy),
        c.resolve<ILogger>(TYPES.Logger),
        c.resolve<PromptFeedbackLog>(TYPES.PromptFeedbackLog),
      );
    });

    container.registerSingleton(TYPES.UsePromptVersionCommand, (c) => {
      return new UsePromptVersionCommand(
        c.resolve<PromptFeedbackLog>(TYPES.PromptFeedbackLog),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.ShowFeedbackReportCommand, (c) => {
      return new ShowFeedbackReportCommand(
        c.resolve<PromptFeedbackLog>(TYPES.PromptFeedbackLog),
        c.resolve<PromptResponseCache>(TYPES.PromptResponseCache),
        c.resolve<PromptLearningStore>(TYPES.PromptLearningStore),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.ExportMcpGoldenCandidatesCommand, (c) => {
      return new ExportMcpGoldenCandidatesCommand(
        c.resolve<PromptLearningStore>(TYPES.PromptLearningStore),
        c.resolve<ILogger>(TYPES.Logger),
      );
    });

    container.registerSingleton(TYPES.RefreshMcpIndexCommand, (c) => {
      return new RefreshMcpIndexCommand(
        c.resolve<MCPToolRegistry>(TYPES.MCPToolRegistry),
        c.resolve<IMcpServerProbe>(TYPES.McpServerProbe),
        c.resolve<IMcpToolIndexStore>(TYPES.McpToolIndexStore),
        c.resolve<IConfigurationManager>(TYPES.ConfigurationManager),
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
