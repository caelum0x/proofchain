/**
 * Typed application errors + the structured error/response envelope.
 *
 * Every failure that reaches an HTTP boundary is converted into an `AppError`
 * so the response envelope is consistent and never leaks stack traces or
 * secrets to the client.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFIG_ERROR'
  | 'CHAIN_ERROR'
  | 'MODEL_ERROR'
  | 'ORCHESTRATION_TIMEOUT'
  | 'ORCHESTRATION_LIMIT'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  CONFIG_ERROR: 500,
  CHAIN_ERROR: 502,
  MODEL_ERROR: 502,
  ORCHESTRATION_TIMEOUT: 504,
  ORCHESTRATION_LIMIT: 422,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Safely extract a message from an unknown thrown value. Viem/SDK errors are
 * not always standard `Error` instances, so `(err as Error).message` can be
 * `undefined` and drop all detail. Use this everywhere a catch value is logged.
 */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const validationError = (message: string, details?: unknown): AppError =>
  new AppError('VALIDATION_ERROR', message, details);

export const notFound = (message: string): AppError =>
  new AppError('NOT_FOUND', message);

export const chainError = (message: string, details?: unknown): AppError =>
  new AppError('CHAIN_ERROR', message, details);

export const modelError = (message: string, details?: unknown): AppError =>
  new AppError('MODEL_ERROR', message, details);

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ErrorPayload | null;
}

export const ok = <T>(data: T): ApiEnvelope<T> => ({
  success: true,
  data,
  error: null,
});

export const fail = (error: ErrorPayload): ApiEnvelope<never> => ({
  success: false,
  data: null,
  error,
});

/**
 * Normalize any thrown value into an AppError without swallowing information.
 * Unknown errors become INTERNAL_ERROR with a generic client message; the
 * original is preserved in `details` for server-side logging only.
 */
export const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return new AppError('INTERNAL_ERROR', 'Internal server error', {
      cause: err.message,
    });
  }
  return new AppError('INTERNAL_ERROR', 'Internal server error', {
    cause: String(err),
  });
};
