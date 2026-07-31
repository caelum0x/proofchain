/**
 * Object-storage abstraction — a key/value blob store with a consistent,
 * `Result`-returning contract across every backend (local, S3/R2, IPFS).
 *
 * Fill convention: add one adapter per provider under `src/storage/adapters/`.
 * Each adapter module MUST call `registerStorageAdapter(name, factory)` at load
 * time (see `local.ts` / `s3.ts`) and then run `pnpm run barrels` so the
 * generated `adapters/index.ts` imports it. Nothing else needs editing.
 */
import type { Result } from "../errors.js";

/** Options accepted when writing an object. */
export interface PutOptions {
  /** MIME type recorded with the object. */
  readonly contentType?: string;
  /** Arbitrary string metadata (backend-dependent persistence). */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Metadata describing a stored object. */
export interface StoredObject {
  /** The key the object is addressed by within its backend. */
  readonly key: string;
  /** Canonical URI (`s3://bucket/key`, `ipfs://cid`, `mem://key`, …). */
  readonly uri: string;
  /** Size in bytes of the stored payload. */
  readonly size: number;
  /** Which backend produced this result. */
  readonly backend: string;
  /** MIME type, when known. */
  readonly contentType?: string;
  /** Publicly resolvable URL, when the backend exposes one. */
  readonly url?: string;
}

/** A pluggable blob-storage backend. All methods are non-throwing. */
export interface StorageAdapter {
  /** Stable backend identifier (e.g. "local", "s3", "ipfs"). */
  readonly backend: string;
  /** Store raw bytes under `key`. */
  put(key: string, data: Uint8Array, options?: PutOptions): Promise<Result<StoredObject>>;
  /** Store a JSON-serializable value under `key` (canonical JSON bytes). */
  putJson(key: string, value: unknown, options?: PutOptions): Promise<Result<StoredObject>>;
  /** Read bytes for `key`, or `null` when absent. */
  get(key: string): Promise<Result<Uint8Array | null>>;
  /** Delete `key`. Resolves `true` regardless of prior existence. */
  delete(key: string): Promise<Result<boolean>>;
  /** Whether an object exists for `key`. */
  exists(key: string): Promise<Result<boolean>>;
}

/** Factory that builds an adapter from the resolved infra config. */
export type StorageAdapterFactory = (
  config: import("../env.js").InfraConfig,
) => StorageAdapter;
