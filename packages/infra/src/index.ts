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

// Repositories — typed data access. `base` + one file per table (barrel is
// generated; run `pnpm run barrels` after adding a repository).
export {
  BaseRepository,
  type RepositoryConfig,
  type QuerySpec,
  type QueryFilter,
  type FilterOp,
} from "./repositories/base.js";
export { DealsRepository, createDealsRepository } from "./repositories/deals.js";

// Storage — blob store interface + adapters (local, s3/r2, ipfs).
export {
  createStorage,
  createStorageAdapter,
  registerStorageAdapter,
  registeredStorageAdapters,
  signRequest,
  hashPayload,
  type StorageAdapter,
  type StoredObject,
  type PutOptions,
  type StorageAdapterFactory,
} from "./storage/index.js";

// Queue — durable job queue (in-memory + Supabase-backed).
export {
  createJobQueue,
  createMemoryJobQueue,
  createSupabaseJobQueue,
  emptyStats,
  type JobQueue,
  type QueueJob,
  type QueueJobStatus,
  type EnqueueInput,
  type FailOptions,
  type JobQueueDeps,
} from "./queue/index.js";

// Notifications — multi-channel dispatch (console/no-op default).
export {
  createNotifier,
  createChannel,
  registerChannel,
  registeredChannels,
  type Notifier,
  type Notification,
  type NotificationChannel,
  type ChannelContext,
  type ChannelFactory,
  type DeliveryResult,
  type EmailMessage,
} from "./notifications/index.js";

// Cache — in-memory TTL cache.
export { TtlCache, type TtlCacheOptions } from "./cache/index.js";

// Events — transactional outbox (in-memory + Supabase-backed) + relay.
export {
  createOutbox,
  createMemoryOutbox,
  createSupabaseOutbox,
  drain,
  type OutboxStore,
  type OutboxEvent,
  type OutboxAppend,
  type OutboxStatus,
  type OutboxDeps,
  type DrainResult,
} from "./events/index.js";

// Migrations — no-op-safe runner + registry.
export {
  createMigrationRunner,
  runMigrations,
  registerMigration,
  registeredMigrations,
  type Migration,
  type MigrationContext,
  type MigrationRunResult,
  type MigrationRunner,
} from "./migrations/index.js";
