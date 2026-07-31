import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";

/**
 * Structured error handling. We never swallow errors; we translate them into a
 * consistent envelope and a human-friendly message for the UI, while keeping
 * the raw cause for logging.
 */

export type ErrorEnvelope<T = never> =
  | { readonly success: true; readonly data: T; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: AppErrorShape };

export interface AppErrorShape {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

export class AppError extends Error {
  readonly code: string;
  readonly details?: string;

  constructor(code: string, message: string, options?: { details?: string; cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.details = options?.details;
  }

  toShape(): AppErrorShape {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function ok<T>(data: T): ErrorEnvelope<T> {
  return { success: true, data, error: null };
}

export function fail(error: AppErrorShape): ErrorEnvelope<never> {
  return { success: false, data: null, error };
}

/**
 * Map an unknown thrown value to a stable, user-facing message. Understands
 * viem's revert / user-rejection error hierarchy and known contract custom
 * errors from the ProofChain contracts.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;

  if (error instanceof BaseError) {
    const rejected = error.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected) return "Transaction was rejected in your wallet.";

    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName ?? reverted.reason;
      if (name) return contractErrorMessage(name);
      if (reverted.shortMessage) return reverted.shortMessage;
    }

    return error.shortMessage || error.message;
  }

  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

/** Human copy for the known Solidity custom errors. */
export function contractErrorMessage(errorName: string): string {
  switch (errorName) {
    case "BatchExists":
      return "This batch id is already registered.";
    case "UnknownBatch":
      return "That batch is not registered in the provenance registry.";
    case "EmptyMetadata":
      return "Metadata URI cannot be empty.";
    case "InvalidScore":
      return "Attestation score is out of range (0–10000 bps).";
    case "AlreadyAttested":
      return "This batch has already been attested.";
    case "NotAttested":
      return "This batch has not been attested yet.";
    case "DealExists":
      return "A deal already exists for this batch.";
    case "NotFunded":
      return "No funded deal exists for this batch.";
    case "ZeroAmount":
      return "Amount must be greater than zero.";
    case "AlreadySettled":
      return "This deal has already been settled.";
    case "AccessControlUnauthorizedAccount":
      return "Your account is not authorized for this action.";
    default:
      return `Transaction reverted: ${errorName}`;
  }
}

export function toEnvelope(error: unknown, code = "UNKNOWN"): ErrorEnvelope<never> {
  if (error instanceof AppError) return fail(error.toShape());
  return fail({
    code,
    message: getErrorMessage(error),
    details: error instanceof Error ? error.stack : undefined,
  });
}
