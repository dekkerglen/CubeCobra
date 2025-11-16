import { ErrorCode } from './errorCodes';

export interface AppErrorParams {
  cause?: Error;
  meta?: any;
}

export class AppError extends Error {
  public readonly meta: any | undefined;
  public readonly cause: Error | undefined;

  constructor(
    message: string,
    public code: ErrorCode,
    params?: AppErrorParams,
  ) {
    super(message);
    this.name = 'AppError';
    this.cause = params?.cause;
    this.meta = params?.meta;

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    if (this.cause?.stack) {
      this.stack += `\nCaused by: ${this.cause.stack}`;
    }
  }
}
