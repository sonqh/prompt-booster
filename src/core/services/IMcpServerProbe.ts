/**
 * Interface for McpServerProbe — defined alongside the service per repo
 * convention (cf. IPromptOptimizationService).
 */
import { McpProbeResult } from "../../shared/interfaces/IMcpProcessTransport";

/** A server to probe: launch command from the user's MCP config. */
export interface McpProbeTarget {
  serverName: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface IMcpServerProbe {
  /**
   * List a server's tools via the JSON-RPC `initialize` + `tools/list`
   * handshake. Never throws and never spawns on the enhance path — callers
   * run this in the background or from the refresh command only.
   *
   * @param timeoutMs hard ceiling for the whole handshake (default 6s)
   */
  listServerTools(target: McpProbeTarget, timeoutMs?: number): Promise<McpProbeResult>;
}
