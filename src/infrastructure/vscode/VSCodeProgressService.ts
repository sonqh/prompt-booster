/**
 * VS Code Progress Service - implements IProgressService interface
 */
import * as vscode from "vscode";
import {
  IProgressService,
  IProgressReporter,
  ICancellationToken,
  ProgressOptions,
} from "../../shared/interfaces/IProgressReporter";

class VSCodeProgressReporter implements IProgressReporter {
  constructor(
    private progress: vscode.Progress<{ message?: string; increment?: number }>,
  ) {}

  report(message: string): void {
    this.progress.report({ message });
  }

  reportProgress(increment: number): void {
    this.progress.report({ increment });
  }
}

class VSCodeCancellationToken implements ICancellationToken {
  constructor(private token: vscode.CancellationToken) {}

  get isCancellationRequested(): boolean {
    return this.token.isCancellationRequested;
  }

  onCancellationRequested(listener: () => void): void {
    this.token.onCancellationRequested(listener);
  }
}

export class VSCodeProgressService implements IProgressService {
  async withProgress<T>(
    options: ProgressOptions,
    task: (
      reporter: IProgressReporter,
      token: ICancellationToken,
    ) => Promise<T>,
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: options.title,
        cancellable: options.cancellable ?? true,
      },
      async (progress, token) => {
        const reporter = new VSCodeProgressReporter(progress);
        const cancellationToken = new VSCodeCancellationToken(token);
        return await task(reporter, cancellationToken);
      },
    );
  }
}
