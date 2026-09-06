/**
 * ChildProcessMcpTransport — stdio JSON-RPC adapter for IMcpProcessTransport.
 *
 * Spawns the configured MCP server command, performs the MCP `initialize` +
 * `tools/list` handshake over newline-delimited JSON-RPC on stdio, and
 * enforces the plan's hard timeboxes: 2s initialize, 3s tools/list, and an
 * overall ceiling (`timeoutMs`, default enforced by the probe at 6s) at which
 * the child is killed.
 *
 * Contract (per IMcpProcessTransport): never rejects for handshake/timeout/
 * process failures — resolves `{ tools: [] }`; the child is ALWAYS killed.
 *
 * SECURITY: `env` may contain secrets. It is merged into the child's
 * environment and never logged; error/log lines carry the command and
 * server-facing reason only. stderr is drained but its content is ignored.
 */
import { spawn, ChildProcess } from "child_process";
import {
  IMcpProcessTransport,
  McpProbeRequest,
  McpProbeResult,
  McpProbeTool,
} from "../../shared/interfaces/IMcpProcessTransport";
import { ILogger } from "../../shared/interfaces/ILogger";

const INIT_TIMEOUT_MS = 2_000;
const LIST_TIMEOUT_MS = 3_000;
/** Stop reading a misbehaving server after this much buffered output. */
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  result?: { tools?: unknown };
  error?: { message?: string; code?: number };
}

export class ChildProcessMcpTransport implements IMcpProcessTransport {
  constructor(private logger: ILogger) {}

  listTools(request: McpProbeRequest): Promise<McpProbeResult> {
    return new Promise<McpProbeResult>((resolve) => {
      let child: ChildProcess | undefined;
      let settled = false;
      let buffer = "";
      let initTimer: NodeJS.Timeout | undefined;
      let listTimer: NodeJS.Timeout | undefined;
      const overallTimer = setTimeout(() => finish([], "overall timeout"), request.timeoutMs);

      const clearTimers = (): void => {
        clearTimeout(overallTimer);
        if (initTimer) clearTimeout(initTimer);
        if (listTimer) clearTimeout(listTimer);
      };

      const finish = (tools: McpProbeTool[], reason: string): void => {
        if (settled) return;
        settled = true;
        clearTimers();
        try {
          child?.kill();
        } catch {
          /* already gone */
        }
        if (reason !== "ok") {
          this.logger.warn(
            `ChildProcessMcpTransport: ${request.command} handshake ended ` +
              `with no tools (${reason})`,
          );
        }
        resolve({ tools });
      };

      const send = (message: unknown): void => {
        try {
          child?.stdin?.write(JSON.stringify(message) + "\n");
        } catch {
          finish([], "stdin closed");
        }
      };

      try {
        child = spawn(request.command, request.args ?? [], {
          stdio: ["pipe", "pipe", "pipe"],
          // env passed through to the child — never logged.
          env: { ...process.env, ...(request.env ?? {}) },
        });
      } catch (error) {
        this.logger.warn(
          `ChildProcessMcpTransport: failed to spawn ${request.command} (${
            error instanceof Error ? error.message : String(error)
          })`,
        );
        finish([], "spawn failed");
        return;
      }

      child.on("error", (error) => {
        this.logger.warn(
          `ChildProcessMcpTransport: ${request.command} process error: ${
            error.message
          }`,
        );
        finish([], "process error");
      });
      child.on("exit", () => finish([], "process exited early"));
      // Drain stderr so the child never blocks on a full pipe; content is
      // deliberately ignored (may echo env-adjacent diagnostics).
      child.stderr?.on("data", () => {});

      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        if (settled) return;
        buffer += chunk;
        if (buffer.length > MAX_BUFFER_BYTES) {
          finish([], "response too large");
          return;
        }
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            let message: JsonRpcMessage | undefined;
            try {
              message = JSON.parse(line);
            } catch {
              message = undefined; // non-JSON noise on stdout — skip line
            }
            handleMessage(message);
          }
          newline = buffer.indexOf("\n");
        }
      });

      const handleMessage = (message: JsonRpcMessage | undefined): void => {
        if (!message || typeof message !== "object" || settled) return;
        if (message.id === 1) {
          // initialize response
          if (initTimer) clearTimeout(initTimer);
          if (message.error) {
            finish([], `initialize error: ${message.error.message ?? "unknown"}`);
            return;
          }
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
          listTimer = setTimeout(() => finish([], "tools/list timeout"), LIST_TIMEOUT_MS);
        } else if (message.id === 2) {
          // tools/list response
          if (message.error) {
            finish([], `tools/list error: ${message.error.message ?? "unknown"}`);
            return;
          }
          const tools = message.result?.tools;
          finish(Array.isArray(tools) ? (tools as McpProbeTool[]) : [], "ok");
        }
        // Notifications and unrelated messages are ignored.
      };

      initTimer = setTimeout(() => finish([], "initialize timeout"), INIT_TIMEOUT_MS);
      send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "promptbooster", version: "0.2.4" },
        },
      });
    });
  }
}
