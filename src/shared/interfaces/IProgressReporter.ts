import * as vscode from "vscode";

/**
 * Progress reporter interface - abstraction for progress indicators
 */
export interface IProgressReporter {
  /**
   * Report progress with a message
   */
  report(message: string): void;

  /**
   * Report progress with a percentage
   */
  reportProgress(increment: number): void;
}

/**
 * Options for creating progress
 */
export interface ProgressOptions {
  title: string;
  cancellable?: boolean;
}

/**
 * Progress service interface
 */
export interface IProgressService {
  /**
   * Execute a task with progress indication
   */
  withProgress<T>(
    options: ProgressOptions,
    task: (
      reporter: IProgressReporter,
      token: vscode.CancellationToken,
    ) => Promise<T>,
  ): Promise<T>;
}
