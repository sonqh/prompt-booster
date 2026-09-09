/**
 * Mock IStateRepository — in-memory global/workspace state for hermetic tests
 * of services that persist via the state port.
 */
import { IStateRepository } from "../../infrastructure/state/StateRepository";

export class MockStateRepository implements IStateRepository {
  public global = new Map<string, unknown>();
  public workspace = new Map<string, unknown>();
  /** When set, the next write throws (failure-posture tests). */
  public failOnWrite = false;

  getGlobal<T>(key: string): T | undefined {
    return this.global.get(key) as T | undefined;
  }

  async setGlobal<T>(key: string, value: T): Promise<void> {
    if (this.failOnWrite) throw new Error("mock state write failure");
    this.global.set(key, value);
  }

  getWorkspace<T>(key: string): T | undefined {
    return this.workspace.get(key) as T | undefined;
  }

  async setWorkspace<T>(key: string, value: T): Promise<void> {
    if (this.failOnWrite) throw new Error("mock state write failure");
    this.workspace.set(key, value);
  }
}
