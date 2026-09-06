/**
 * Mock IConfigChangeWatcher — records subscriptions and lets tests fire
 * config-change events manually to assert cache invalidation.
 */
import {
  IDisposable,
  IConfigChangeWatcher,
} from "../../shared/interfaces/IConfigChangeWatcher";

export class MockConfigChangeWatcher implements IConfigChangeWatcher {
  public listeners: (() => void)[] = [];
  public disposed = false;

  onConfigChanged(listener: () => void): IDisposable {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      },
    };
  }

  /** Test helper: simulate a config change notification. */
  fire(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  dispose(): void {
    this.listeners = [];
    this.disposed = true;
  }
}
