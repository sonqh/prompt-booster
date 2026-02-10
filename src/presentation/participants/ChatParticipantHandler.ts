/**
 * Chat Participant Handler - Manages GitHub Copilot Chat participant for realtime mode
 */
import * as vscode from "vscode";
import * as path from "path";
import { Container } from "../../di/Container";
import { TYPES } from "../../di/types";
import { IConfigurationManager } from "../../shared/interfaces/IConfigurationManager";
import { ILogger } from "../../shared/interfaces/ILogger";
import { RealtimeModeStrategy } from "../../core/strategies/RealtimeModeStrategy";

export class ChatParticipantHandler {
  constructor(private container: Container) {}

  /**
   * Register the chat participant
   */
  register(context: vscode.ExtensionContext): void {
    const logger = this.container.resolve<ILogger>(TYPES.Logger);
    const configManager = this.container.resolve<IConfigurationManager>(
      TYPES.ConfigurationManager,
    );

    try {
      const realtimeStrategy = this.container.resolve<RealtimeModeStrategy>(
        TYPES.RealtimeModeStrategy,
      );

      const participant = vscode.chat.createChatParticipant(
        "promptBooster.interceptor",
        async (request, chatContext, stream, token) => {
          await this.handleChatRequest(
            request,
            chatContext,
            stream,
            token,
            realtimeStrategy,
            configManager,
            logger,
          );
        },
      );

      // Configure participant
      participant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, "resources", "icon.png"),
      );

      context.subscriptions.push(participant);
      logger.log("Chat participant registered successfully");
    } catch (error) {
      logger.error("Failed to register chat participant", error as Error);
      // Don't fail activation if chat participant registration fails
      // This allows the extension to work in older VS Code versions
    }
  }

  /**
   * Handle chat requests when in realtime mode
   */
  private async handleChatRequest(
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    realtimeStrategy: RealtimeModeStrategy,
    configManager: IConfigurationManager,
    logger: ILogger,
  ): Promise<void> {
    try {
      // Check if we should intercept
      const currentMode = configManager.getOperationMode();
      const autoOptimize = configManager.isAutoOptimizeEnabled();

      if (currentMode !== "realtime" || !autoOptimize) {
        stream.markdown(
          "ℹ️ PromptBooster is not in realtime mode with auto-optimization enabled.",
        );
        return;
      }

      const prompt = request.prompt;
      logger.log(`Chat request received: ${prompt.substring(0, 50)}...`);

      // Execute realtime strategy
      await realtimeStrategy.execute({
        prompt,
        metadata: {
          stream,
          request,
          token,
        },
      });

      // Note: The strategy handles showing the preview UI via chat stream
      // We don't need to append anything else here if the strategy ran successfully
    } catch (error) {
      logger.error("Chat request handling failed", error as Error);
      stream.markdown(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
