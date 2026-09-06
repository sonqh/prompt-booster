/**
 * Service identifiers for dependency injection
 */
export const TYPES = {
  // Infrastructure
  Logger: Symbol.for("ILogger"),
  ConfigurationManager: Symbol.for("IConfigurationManager"),
  FileSystem: Symbol.for("IFileSystem"),
  ProgressService: Symbol.for("IProgressService"),
  StateRepository: Symbol.for("IStateRepository"),
  LanguageModelProvider: Symbol.for("ILanguageModelProvider"),
  ExtensionContext: Symbol.for("ExtensionContext"),

  // Infrastructure - MCP adapters (Enhancement 4 v2)
  McpEnvironmentProvider: Symbol.for("IMcpEnvironmentProvider"),
  McpRuntimeToolsProvider: Symbol.for("IMcpRuntimeToolsProvider"),
  McpProcessTransport: Symbol.for("IMcpProcessTransport"),
  ConfigChangeWatcher: Symbol.for("IConfigChangeWatcher"),

  // Core Services
  PromptOptimizationService: Symbol.for("IPromptOptimizationService"),
  WorkspaceContextGatherer: Symbol.for("WorkspaceContextGatherer"),
  ReferenceResolver: Symbol.for("ReferenceResolver"),
  MCPToolRegistry: Symbol.for("MCPToolRegistry"),
  McpToolIndexStore: Symbol.for("IMcpToolIndexStore"),
  McpServerProbe: Symbol.for("IMcpServerProbe"),

  // Strategies
  ManualModeStrategy: Symbol.for("ManualModeStrategy"),
  RealtimeModeStrategy: Symbol.for("RealtimeModeStrategy"),
  FileModeStrategy: Symbol.for("FileModeStrategy"),

  // Presentation - Commands
  CommandRegistry: Symbol.for("CommandRegistry"),
  BoostCommand: Symbol.for("BoostCommand"),
  ProcessFileCommand: Symbol.for("ProcessFileCommand"),
  SwitchModeCommand: Symbol.for("SwitchModeCommand"),
  SwitchModelCommand: Symbol.for("SwitchModelCommand"),
  ChatCommandsHandler: Symbol.for("ChatCommandsHandler"),
  RefreshMcpIndexCommand: Symbol.for("RefreshMcpIndexCommand"),

  // Presentation - UI
  ChatParticipantHandler: Symbol.for("ChatParticipantHandler"),
  StatusBarController: Symbol.for("StatusBarController"),
};
