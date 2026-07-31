/**
 * Storage subsystem entrypoint.
 *
 * Importing this module wires up every registered adapter (via the generated
 * `adapters/index.ts` barrel) and exposes:
 *   * `createStorage(config)` — auto-selects the best configured backend.
 *   * `createStorageAdapter(name, config)` — build a specific backend by name.
 *   * the `StorageAdapter` interface + registry helpers for advanced use.
 *
 * Fill convention: add `adapters/<provider>.ts`, self-register, run
 * `pnpm run barrels`. No edits to this file are needed.
 */
import { loadInfraConfig, type InfraConfig } from "../env.js";
import { InfraError, InfraErrorCode } from "../errors.js";
import type { StorageAdapter } from "./types.js";
import { getStorageAdapterFactory, registeredStorageAdapters } from "./registry.js";
// Side-effect import: evaluates every adapter module so they self-register.
import "./adapters/index.js";

export type { StorageAdapter, StoredObject, PutOptions, StorageAdapterFactory } from "./types.js";
export {
  registerStorageAdapter,
  getStorageAdapterFactory,
  registeredStorageAdapters,
} from "./registry.js";
export { signRequest, hashPayload } from "./sigv4.js";

/**
 * Build a specific storage adapter by name. Throws `InfraError` if the name is
 * not registered — a programmer error, surfaced loudly at startup.
 */
export function createStorageAdapter(
  name: string,
  config: InfraConfig = loadInfraConfig(),
): StorageAdapter {
  const factory = getStorageAdapterFactory(name);
  if (factory === undefined) {
    throw new InfraError(
      InfraErrorCode.NOT_CONFIGURED,
      `Unknown storage adapter "${name}"`,
      { available: registeredStorageAdapters() },
    );
  }
  return factory(config);
}

/**
 * Auto-select a storage backend: S3/R2 when configured, otherwise the local
 * in-memory fallback. Always returns a usable adapter (never throws).
 */
export function createStorage(
  config: InfraConfig = loadInfraConfig(),
): StorageAdapter {
  const name = config.s3.configured ? "s3" : "local";
  return createStorageAdapter(name, config);
}
