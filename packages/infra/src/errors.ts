/**
 * Structured error envelopes shared across the infra package.
 *
 * Every fallible operation returns a `Result<T>` rather than throwing across
 * module boundaries. Errors are never swallowed: they are captured into a typed
 * envelope with a stable machine-readable `code`, a human message, and optional
 * structured `details` for logging.
 */

/** Stable, machine-readable error codes emitted by the infra package. */
export const InfraErrorCode = {
  VALIDATION: "INFRA_VALIDATION",
  NOT_CONFIGURED: "INFRA_NOT_CONFIGURED",
  SUPABASE: "INFRA_SUPABASE",
  IPFS: "INFRA_IPFS",
  NETWORK: "INFRA_NETWORK",
  UNEXPECTED: "INFRA_UNEXPECTED",
} as const;

export type InfraErrorCode =
  (typeof InfraErrorCode)[keyof typeof InfraErrorCode];

/** Serializable error envelope. Safe to persist (e.g. jobs.error jsonb). */
export interface ErrorEnvelope {
  readonly code: InfraErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Discriminated result union. Use `isOk` / `isErr` to narrow. Immutable by
 * construction — helpers always return fresh frozen objects.
 */
export type Result<T> =
  | { readonly success: true; readonly data: T; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: ErrorEnvelope };

export function ok<T>(data: T): Result<T> {
  return Object.freeze({ success: true, data, error: null }) as Result<T>;
}

export function err<T = never>(
  code: InfraErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Result<T> {
  const envelope: ErrorEnvelope = Object.freeze(
    details === undefined
      ? { code, message }
      : { code, message, details: Object.freeze({ ...details }) },
  );
  return Object.freeze({ success: false, data: null, error: envelope }) as Result<T>;
}

export function isOk<T>(
  result: Result<T>,
): result is { success: true; data: T; error: null } {
  return result.success;
}

export function isErr<T>(
  result: Result<T>,
): result is { success: false; data: null; error: ErrorEnvelope } {
  return !result.success;
}

/**
 * Typed error for the rare cases where throwing is idiomatic (e.g. constructor
 * misuse). Carries the same envelope shape so callers can normalize.
 */
export class InfraError extends Error {
  readonly code: InfraErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: InfraErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "InfraError";
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
  }

  toEnvelope(): ErrorEnvelope {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

/**
 * Normalize an unknown thrown value into an `ErrorEnvelope`. Never throws.
 * Extracts message from Error/InfraError, falls back to String() otherwise.
 */
export function toEnvelope(
  error: unknown,
  fallbackCode: InfraErrorCode = InfraErrorCode.UNEXPECTED,
): ErrorEnvelope {
  if (error instanceof InfraError) {
    return error.toEnvelope();
  }
  if (error instanceof Error) {
    return { code: fallbackCode, message: error.message };
  }
  return { code: fallbackCode, message: String(error) };
}
