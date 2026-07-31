import { z } from "zod";

/**
 * Stable, machine-readable error codes used across the shared package.
 * Consumers can branch on these without string-matching messages.
 */
export const ErrorCode = {
  VALIDATION: "SHARED_VALIDATION_ERROR",
  MISSING_ADDRESS: "SHARED_MISSING_ADDRESS",
  INVALID_ADDRESS: "SHARED_INVALID_ADDRESS",
  DECODE: "SHARED_DECODE_ERROR",
  DEPLOYMENT_PARSE: "SHARED_DEPLOYMENT_PARSE_ERROR",
  UNKNOWN: "SHARED_UNKNOWN_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Serializable error envelope suitable for API responses and logs. */
export interface ErrorEnvelope {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * Base error for every failure raised by this package. Carries a stable `code`
 * and optional structured `details`, and never loses the underlying cause.
 */
export class ProofchainError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.details = options?.details;
    // Restore prototype chain for correct `instanceof` across transpile targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Convert to a plain, serializable envelope. */
  toEnvelope(): ErrorEnvelope {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

/** A boundary input failed validation. */
export class ValidationError extends ProofchainError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION, message, { details });
  }
}

/** A required contract address is not configured for the requested chain. */
export class MissingAddressError extends ProofchainError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.MISSING_ADDRESS, message, { details });
  }
}

/** A supplied value is not a valid EVM address. */
export class InvalidAddressError extends ProofchainError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.INVALID_ADDRESS, message, { details });
  }
}

/** An on-chain log could not be decoded against any known ABI. */
export class DecodeError extends ProofchainError {
  constructor(message: string, options?: { details?: unknown; cause?: unknown }) {
    super(ErrorCode.DECODE, message, options);
  }
}

/** A deployment manifest could not be parsed into the expected shape. */
export class DeploymentParseError extends ProofchainError {
  constructor(message: string, options?: { details?: unknown; cause?: unknown }) {
    super(ErrorCode.DEPLOYMENT_PARSE, message, options);
  }
}

/**
 * Normalize any thrown value into an {@link ErrorEnvelope}. Never throws and
 * never swallows information: unknown errors keep their message and are tagged
 * with the {@link ErrorCode.UNKNOWN} code.
 */
export function toErrorEnvelope(error: unknown): ErrorEnvelope {
  if (error instanceof ProofchainError) {
    return error.toEnvelope();
  }
  if (error instanceof z.ZodError) {
    return {
      code: ErrorCode.VALIDATION,
      message: "Input validation failed.",
      details: error.flatten(),
    };
  }
  if (error instanceof Error) {
    return { code: ErrorCode.UNKNOWN, message: error.message };
  }
  return {
    code: ErrorCode.UNKNOWN,
    message: "An unknown error occurred.",
    details: error,
  };
}

/**
 * Discriminated result envelope: `{ success, data, error }`. Enables callers to
 * handle failures explicitly without try/catch at every call site.
 */
export type Result<T> =
  | { readonly success: true; readonly data: T; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: ErrorEnvelope };

/** Build a successful {@link Result}. */
export function ok<T>(data: T): Result<T> {
  return { success: true, data, error: null };
}

/** Build a failed {@link Result} from any thrown value or envelope. */
export function fail<T = never>(error: unknown): Result<T> {
  const envelope =
    isErrorEnvelope(error) ? error : toErrorEnvelope(error);
  return { success: false, data: null, error: envelope };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}
