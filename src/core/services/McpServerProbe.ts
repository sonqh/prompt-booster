/**
 * McpServerProbe — opt-in MCP `tools/list` acquisition (Enhancement 4 v2).
 *
 * Pure protocol/logic layer over IMcpProcessTransport: builds the probe
 * request, enforces the overall deadline, tolerates a hanging or rejecting
 * transport, and filters malformed tool entries. Process spawning, framing
 * and child-kill live in the transport adapter (src/infrastructure/mcp).
 *
 * SECURITY: `env` may contain secrets — it is forwarded to the transport but
 * NEVER logged (probe log lines carry server name / command only).
 */
import {
  IMcpProcessTransport,
  McpProbeRequest,
  McpProbeResult,
  McpProbeTool,
} from "../../shared/interfaces/IMcpProcessTransport";
import { ILogger } from "../../shared/interfaces/ILogger";
import {
  IMcpServerProbe,
  McpProbeTarget,
} from "./IMcpServerProbe";

export class McpServerProbe implements IMcpServerProbe {
  /** Plan decision record: 2s init / 3s list inside a 6s overall budget. */
  public static readonly DEFAULT_TIMEOUT_MS = 6_000;

  constructor(
    private transport: IMcpProcessTransport,
    private logger: ILogger,
  ) {}

  async listServerTools(
    target: McpProbeTarget,
    timeoutMs: number = McpServerProbe.DEFAULT_TIMEOUT_MS,
  ): Promise<McpProbeResult> {
    const request: McpProbeRequest = {
      command: target.command,
      args: target.args,
      // env is passed through to the transport, never logged below.
      env: target.env,
      timeoutMs,
    };

    try {
      const result = await Promise.race([
        this.transport.listTools(request),
        this.deadline(timeoutMs),
      ]);
      return { tools: this.sanitizeTools(result.tools) };
    } catch (error) {
      // Never throws across the caller — an empty result means "no tools".
      this.logger.warn(
        `McpServerProbe: probing server "${target.serverName}" ` +
          `(${target.command}) failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
      );
      return { tools: [] };
    }
  }

  /** Drop entries that cannot be represented as tool descriptors. */
  private sanitizeTools(tools: unknown): McpProbeTool[] {
    if (!Array.isArray(tools)) return [];
    return tools.filter(
      (tool): tool is McpProbeTool =>
        !!tool &&
        typeof tool === "object" &&
        typeof (tool as McpProbeTool).name === "string" &&
        (tool as McpProbeTool).name !== "",
    );
  }

  private deadline(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`probe timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
  }
}
