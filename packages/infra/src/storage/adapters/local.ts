/**
 * Local in-memory storage adapter — the always-available offline fallback.
 *
 * Backs a process-lifetime `Map`, so it is a fully functional blob store for
 * tests, local dev, and any environment where no external object store is
 * configured. Other adapters (e.g. S3) delegate to it when unconfigured.
 *
 * Registered under the name "local".
 */
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../../errors.js";
import { registerStorageAdapter } from "../registry.js";
import type { PutOptions, StorageAdapter, StoredObject } from "../types.js";

interface Entry {
  readonly data: Uint8Array;
  readonly contentType: string;
}

/** Build a local adapter over an isolated backing map (defaults to a shared one). */
export function createLocalStorageAdapter(
  store: Map<string, Entry> = sharedStore,
): StorageAdapter {
  return {
    backend: "local",

    async put(
      key: string,
      data: Uint8Array,
      options?: PutOptions,
    ): Promise<Result<StoredObject>> {
      const invalid = validateKey(key) ?? validateBytes(data);
      if (invalid !== null) return invalid;
      const contentType = options?.contentType ?? "application/octet-stream";
      // Copy so external mutation of the caller's buffer can't corrupt the store.
      store.set(key, { data: data.slice(), contentType });
      return ok(describe(key, data.byteLength, contentType));
    },

    async putJson(
      key: string,
      value: unknown,
      options?: PutOptions,
    ): Promise<Result<StoredObject>> {
      let bytes: Uint8Array;
      try {
        bytes = new TextEncoder().encode(JSON.stringify(value));
      } catch (error) {
        return err(InfraErrorCode.VALIDATION, "putJson received non-serializable value", {
          cause: toEnvelope(error),
        });
      }
      return this.put(key, bytes, {
        contentType: options?.contentType ?? "application/json",
        ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
      });
    },

    async get(key: string): Promise<Result<Uint8Array | null>> {
      const entry = store.get(key);
      if (entry === undefined) return ok<Uint8Array | null>(null);
      return ok<Uint8Array | null>(entry.data.slice());
    },

    async delete(key: string): Promise<Result<boolean>> {
      store.delete(key);
      return ok(true);
    },

    async exists(key: string): Promise<Result<boolean>> {
      return ok(store.has(key));
    },
  };
}

const sharedStore = new Map<string, Entry>();

function describe(key: string, size: number, contentType: string): StoredObject {
  return Object.freeze({
    key,
    uri: `mem://${key}`,
    size,
    backend: "local",
    contentType,
  });
}

function validateKey(key: string): Result<StoredObject> | null {
  if (typeof key !== "string" || key.length === 0) {
    return err(InfraErrorCode.VALIDATION, "storage key must be a non-empty string");
  }
  return null;
}

function validateBytes(data: Uint8Array): Result<StoredObject> | null {
  if (!(data instanceof Uint8Array)) {
    return err(InfraErrorCode.VALIDATION, "put expects a Uint8Array");
  }
  return null;
}

// Self-register on load so the generated barrel wires it up.
registerStorageAdapter("local", () => createLocalStorageAdapter());
