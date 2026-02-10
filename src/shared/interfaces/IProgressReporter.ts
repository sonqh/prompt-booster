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
      token: ICancellationToken,
    ) => Promise<T>,
  ): Promise<T>;
}

/**
 * Cancellation token interface
 */
export interface ICancellationToken {
  /**
   * Whether cancellation has been requested
   */
  isCancellationRequested: boolean;

  /**
   * Subscribe to cancellation event
   */
  onCancellationRequested(listener: () => void): void;
}
