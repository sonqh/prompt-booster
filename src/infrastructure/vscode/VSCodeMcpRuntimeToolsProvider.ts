/**
 * Adapter for IMcpRuntimeToolsProvider — capability-checked access to the
 * `vscode.lm.tools` proposed API. This is the PRIMARY MCP discovery source
 * (real descriptions for tools the Copilot agent can actually execute).
 *
 * `vscode.lm.tools` is proposed/unstable: every access is guarded with
 * typeof/in checks plus try/catch. When the API is absent (not proposed or
 * not enabled), `isAvailable()` returns false and `listTools()` resolves to
 * [] — callers degrade silently to the fallback discovery chain.
 */
import * as vscode from "vscode";
import {
  IMcpRuntimeTool,
  IMcpRuntimeToolsProvider,
} from "../../shared/interfaces/IMcpRuntimeToolsProvider";
import { ILogger } from "../../shared/interfaces/ILogger";

/**
 * Parse an MCP runtime tool name (`mcp_<server>_<tool>`) back into its parts.
 *
 * Split at the FIRST underscore after the `mcp_` prefix: the remainder is
 * treated as the tool name, so snake_case tool names (`query_db`,
 * `read_file`) survive intact. Server names conventionally use hyphens
 * (`postgres-mcp`), so this heuristic is right for the common case; when the
 * remainder has no underscore at all the name is unparseable and both parts
 * stay undefined (callers treat the tool as name-level data only).
 */
export function parseMcpRuntimeName(
  runtimeName: string,
): { serverName?: string; toolName?: string } {
  if (!runtimeName.startsWith("mcp_")) return {};
  const remainder = runtimeName.slice("mcp_".length);
  const split = remainder.indexOf("_");
  if (split <= 0 || split === remainder.length - 1) return {};
  return {
    serverName: remainder.slice(0, split),
    toolName: remainder.slice(split + 1),
  };
}

interface LanguageModelToolLike {
  name?: unknown;
  description?: unknown;
}

interface LmApiLike {
  tools?: { list?: unknown };
}

export class VSCodeMcpRuntimeToolsProvider implements IMcpRuntimeToolsProvider {
  constructor(private logger: ILogger) {}

  isAvailable(): boolean {
    try {
      const lm = (vscode as unknown as { lm?: LmApiLike }).lm;
      return (
        !!lm &&
        typeof lm === "object" &&
        "tools" in lm &&
        typeof (lm.tools as { list?: unknown }).list === "function"
      );
    } catch {
      return false;
    }
  }

  async listTools(): Promise<IMcpRuntimeTool[]> {
    if (!this.isAvailable()) return [];
    try {
      const lm = (vscode as unknown as { lm: LmApiLike }).lm;
      const tools = (await (
        lm.tools as { list: () => Promise<LanguageModelToolLike[]> }
      ).list()) as LanguageModelToolLike[];
      if (!Array.isArray(tools)) return [];
      return tools
        .map((tool) => this.toRuntimeTool(tool))
        .filter((t): t is IMcpRuntimeTool => t !== undefined);
    } catch (error) {
      // Proposed-API shape drift or transient failure — degrade silently.
      this.logger.warn(
        `VSCodeMcpRuntimeToolsProvider: listing lm.tools failed (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return [];
    }
  }

  /**
   * Map a `vscode.lm.tools` entry to a runtime-tool record. Only
   * `mcp_`-prefixed names are MCP-registered tools; other LM tools are not
   * part of MCP discovery and are filtered out.
   */
  private toRuntimeTool(tool: LanguageModelToolLike): IMcpRuntimeTool | undefined {
    const runtimeName = typeof tool?.name === "string" ? tool.name : "";
    if (!runtimeName || !runtimeName.startsWith("mcp_")) return undefined;
    return {
      runtimeName,
      ...parseMcpRuntimeName(runtimeName),
      description: typeof tool?.description === "string" ? tool.description : "",
    };
  }
}
