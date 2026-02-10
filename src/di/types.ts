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

  // Core Services
  PromptOptimizationService: Symbol.for("IPromptOptimizationService"),
  LanguageModelProvider: Symbol.for("ILanguageModelProvider"),

  // Strategies
  ManualModeStrategy: Symbol.for("ManualModeStrategy"),
  RealtimeModeStrategy: Symbol.for("RealtimeModeStrategy"),
  FileModeStrategy: Symbol.for("FileModeStrategy"),

  // Presentation
  CommandRegistry: Symbol.for("CommandRegistry"),
  ChatParticipantHandler: Symbol.for("ChatParticipantHandler"),
  StatusBarController: Symbol.for("StatusBarController"),
  ProcessButtonController: Symbol.for("ProcessButtonController"),

  // VS Code Context
  ExtensionContext: Symbol.for("vscode.ExtensionContext"),
};
