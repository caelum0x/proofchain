/**
 * @proofchain/infra — public API surface.
 *
 * Infrastructure primitives for ProofChain: a typed Supabase read/write store
 * (with graceful no-op fallback), IPFS pinning (Pinata + local mock fallback),
 * environment config loading, and structured error envelopes.
 */

// Errors / result envelope
export {
  InfraError,
  InfraErrorCode,
  ok,
  err,
  isOk,
  isErr,
  toEnvelope,
  type ErrorEnvelope,
  type Result,
} from "./errors.js";

// Env / config
export {
  loadInfraConfig,
  type InfraConfig,
  type InfraEnv,
} from "./env.js";

// Hashing helpers
export { sha256Hex, sha256Json, canonicalJson } from "./hash.js";

// IPFS
export {
  createIpfsClient,
  pinJson,
  pinFile,
  type IpfsClient,
  type PinResult,
  type PinBackend,
  type PinFileOptions,
} from "./ipfs.js";

// Supabase
export {
  createSupabaseStore,
  type SupabaseStore,
} from "./supabase.js";

// Domain types + zod schemas
export {
  Bytes32Hex,
  AddressHex,
  BasisPoints,
  Uint256String,
  JobStatus,
  DealState,
  ErrorEnvelopeSchema,
  Job,
  JobInput,
  Verdict,
  VerdictInput,
  Deal,
  DealInput,
} from "./types.js";

export type {
  Job as JobRecord,
  JobInput as JobInputRecord,
  Verdict as VerdictRecord,
  VerdictInput as VerdictInputRecord,
  Deal as DealRecord,
  DealInput as DealInputRecord,
} from "./types.js";
