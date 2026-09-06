/**
 * Mock IMcpRuntimeToolsProvider — scripted runtime-API availability + tool
 * lists for hermetic registry tests.
 */
import {
  IMcpRuntimeTool,
  IMcpRuntimeToolsProvider,
} from "../../shared/interfaces/IMcpRuntimeToolsProvider";

export class MockRuntimeToolsProvider implements IMcpRuntimeToolsProvider {
  public available = false;
  public tools: IMcpRuntimeTool[] = [];
  public listCalls = 0;

  isAvailable(): boolean {
    return this.available;
  }

  async listTools(): Promise<IMcpRuntimeTool[]> {
    this.listCalls++;
    return this.available ? this.tools : [];
  }
}
