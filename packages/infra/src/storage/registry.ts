/**
 * Storage adapter registry.
 *
 * Adapters self-register here at module-load time so that adding a new provider
 * is purely additive: create `adapters/<provider>.ts`, call
 * `registerStorageAdapter(...)`, run `pnpm run barrels`. The generated
 * `adapters/index.ts` imports every adapter module, which triggers registration.
 */
import type { StorageAdapterFactory } from "./types.js";

const registry = new Map<string, StorageAdapterFactory>();

/**
 * Register (or replace) a storage adapter factory under `name`. Idempotent —
 * re-registering the same name overwrites, which keeps hot-reload predictable.
 */
export function registerStorageAdapter(
  name: string,
  factory: StorageAdapterFactory,
): void {
  registry.set(name, factory);
}

/** Look up a registered factory, or `undefined` if none. */
export function getStorageAdapterFactory(
  name: string,
): StorageAdapterFactory | undefined {
  return registry.get(name);
}

/** Names of all currently registered adapters, sorted. */
export function registeredStorageAdapters(): readonly string[] {
  return [...registry.keys()].sort();
}
