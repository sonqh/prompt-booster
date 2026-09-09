/**
 * Port for an opt-in MCP `tools/list` handshake against a stdio server.
 *
 * Protocol logic lives in core (`McpServerProbe`); process spawning lives in
 * infrastructure (`ChildProcessMcpTransport`) so core stays vscode/child_process-free.
 *
 * SECURITY: `env` may contain secrets — implementations must pass it through
 * to the spawned process but NEVER log it.
 */
export interface McpProbeRequest {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Hard ceiling for the whole handshake; the transport must kill the process at this point. */
  timeoutMs: number;
}

export interface McpProbeTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpProbeResult {
  /** Empty when the handshake failed, timed out, or returned nothing. */
  tools: McpProbeTool[];
}

export interface IMcpProcessTransport {
  /**
   * Spawn `command args...`, perform the JSON-RPC `initialize` + `tools/list`
   * handshake over stdio, and resolve the tool list.
   *
   * Contract: NEVER rejects for handshake/timeout/process failures — resolves
   * with `tools: []` instead, so callers need no special error path. The child
   * process is always killed (on success, on failure, and no later than
   * `timeoutMs`).
   *
   * SECURITY: `env` may contain secrets — it is passed to the spawned process
   * but MUST NOT be logged or included in error messages.
   */
  listTools(request: McpProbeRequest): Promise<McpProbeResult>;
}
