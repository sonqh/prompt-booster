/**
 * State Repository - manages extension state
 */
import * as vscode from "vscode";

export interface IStateRepository {
  /**
   * Get a value from global state
   */
  getGlobal<T>(key: string): T | undefined;

  /**
   * Set a value in global state
   */
  setGlobal<T>(key: string, value: T): Promise<void>;

  /**
   * Get a value from workspace state
   */
  getWorkspace<T>(key: string): T | undefined;

  /**
   * Set a value in workspace state
   */
  setWorkspace<T>(key: string, value: T): Promise<void>;
}

export class StateRepository implements IStateRepository {
  constructor(private context: vscode.ExtensionContext) {}

  getGlobal<T>(key: string): T | undefined {
    return this.context.globalState.get<T>(key);
  }

  async setGlobal<T>(key: string, value: T): Promise<void> {
    await this.context.globalState.update(key, value);
  }

  getWorkspace<T>(key: string): T | undefined {
    return this.context.workspaceState.get<T>(key);
  }

  async setWorkspace<T>(key: string, value: T): Promise<void> {
    await this.context.workspaceState.update(key, value);
  }
}
