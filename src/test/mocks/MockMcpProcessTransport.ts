/**
 * Mock IMcpProcessTransport — scripted responses for McpServerProbe tests.
 * Records the requests it received (assert `env` is never logged, timeouts
 * are passed through, etc.).
 */
import {
  IMcpProcessTransport,
  McpProbeRequest,
  McpProbeResult,
} from "../../shared/interfaces/IMcpProcessTransport";

export class MockMcpProcessTransport implements IMcpProcessTransport {
  public requests: McpProbeRequest[] = [];
  /** Queue of behaviors per call; each entry is invoked with the request. */
  public behaviors: Array<
    (request: McpProbeRequest) => Promise<McpProbeResult>
  > = [];

  listTools(request: McpProbeRequest): Promise<McpProbeResult> {
    this.requests.push({ ...request });
    const behavior = this.behaviors.shift();
    if (!behavior) {
      return Promise.resolve({ tools: [] });
    }
    return behavior(request);
  }
}
