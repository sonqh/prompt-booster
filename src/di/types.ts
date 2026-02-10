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

  // Core Services
  PromptOptimizationService: Symbol.for("IPromptOptimizationService"),

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

  // Presentation - UI
  ChatParticipantHandler: Symbol.for("ChatParticipantHandler"),
  StatusBarController: Symbol.for("StatusBarController"),
};
