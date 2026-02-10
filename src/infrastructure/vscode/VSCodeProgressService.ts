/**
 * VS Code Progress Service - implements IProgressService interface
 */
import * as vscode from "vscode";
import {
  IProgressService,
  IProgressReporter,
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

export class VSCodeProgressService implements IProgressService {
  async withProgress<T>(
    options: ProgressOptions,
    task: (
      reporter: IProgressReporter,
      token: vscode.CancellationToken,
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
        return await task(reporter, token);
      },
    );
  }
}
