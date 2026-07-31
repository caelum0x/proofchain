/**
 * Typed application errors for the API.
 *
 * Every failure that reaches an HTTP boundary is normalized into an `ApiError`
 * so the response envelope (see `envelope.ts`) is consistent and NEVER leaks a
 * stack trace, a secret, or an internal driver message to the client. Internal
 * detail is preserved in `details` for server-side logging only.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFIG_ERROR'
  | 'CHAIN_ERROR'
  | 'DB_ERROR'
  | 'DB_NOT_CONFIGURED'
  | 'INDEXER_ERROR'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  CONFIG_ERROR: 500,
  CHAIN_ERROR: 502,
  DB_ERROR: 502,
  DB_NOT_CONFIGURED: 503,
  INDEXER_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Safely extract a message from an unknown thrown value. Viem / driver errors
 * are not always standard `Error` instances, so `(err as Error).message` can be
 * `undefined` and drop all detail. Use this everywhere a catch value is logged.
 */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const validationError = (message: string, details?: unknown): ApiError =>
  new ApiError('VALIDATION_ERROR', message, details);

export const notFound = (message: string): ApiError =>
  new ApiError('NOT_FOUND', message);

export const chainError = (message: string, details?: unknown): ApiError =>
  new ApiError('CHAIN_ERROR', message, details);

export const dbError = (message: string, details?: unknown): ApiError =>
  new ApiError('DB_ERROR', message, details);

/**
 * Normalize any thrown value into an `ApiError` without swallowing information.
 * Unknown errors become INTERNAL_ERROR with a generic client message; the
 * original is preserved in `details` for server-side logging only.
 */
export const toApiError = (err: unknown): ApiError => {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) {
    return new ApiError('INTERNAL_ERROR', 'Internal server error', {
      cause: err.message,
    });
  }
  return new ApiError('INTERNAL_ERROR', 'Internal server error', {
    cause: String(err),
  });
};
