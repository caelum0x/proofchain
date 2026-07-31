/**
 * The `{ success, data, error }` response envelope used by EVERY endpoint.
 *
 * A uniform envelope means clients parse one shape for success and failure, and
 * paginated list endpoints carry a `meta` block. Helpers are pure and return
 * fresh objects (no mutation).
 */
import type { ErrorCode } from './errors.js';

export interface ErrorPayload {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

export interface PageMeta {
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: ErrorPayload | null;
  readonly meta?: PageMeta;
}

/** Success envelope carrying a data payload. */
export const ok = <T>(data: T): ApiEnvelope<T> => ({
  success: true,
  data,
  error: null,
});

/** Success envelope for a paginated list, carrying `meta` pagination info. */
export const okPage = <T>(data: readonly T[], meta: PageMeta): ApiEnvelope<readonly T[]> => ({
  success: true,
  data,
  error: null,
  meta,
});

/** Failure envelope. `data` is always null on failure. */
export const fail = (error: ErrorPayload): ApiEnvelope<never> => ({
  success: false,
  data: null,
  error,
});
