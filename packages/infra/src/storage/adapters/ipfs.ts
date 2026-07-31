/**
 * IPFS storage adapter — reuses the existing Pinata/local-mock IPFS client
 * (`src/ipfs.ts`) behind the common `StorageAdapter` interface.
 *
 * IPFS is content-addressed: the `key` argument is treated as a logical name
 * (recorded in metadata) but the returned `uri`/`key` is the resulting CID.
 * Because content addressing has no server-side lookup or delete in the pinning
 * API surface we expose, `get`/`exists`/`delete` return a clear UNEXPECTED /
 * unsupported envelope rather than lying about success.
 *
 * Registered under the name "ipfs".
 */
import { ok, err, InfraErrorCode, type Result } from "../../errors.js";
import { createIpfsClient, type IpfsClient } from "../../ipfs.js";
import { registerStorageAdapter } from "../registry.js";
import type { PutOptions, StorageAdapter, StoredObject } from "../types.js";

/** Build an IPFS-backed storage adapter over the given (or env) IPFS client. */
export function createIpfsStorageAdapter(
  client: IpfsClient = createIpfsClient(),
): StorageAdapter {
  const unsupported = <T>(op: string): Result<T> =>
    err<T>(
      InfraErrorCode.UNEXPECTED,
      `IPFS storage is content-addressed and does not support ${op}`,
    );

  return {
    backend: "ipfs",

    async put(
      key: string,
      data: Uint8Array,
      options?: PutOptions,
    ): Promise<Result<StoredObject>> {
      const pinned = await client.pinFile(data, {
        name: key,
        ...(options?.contentType !== undefined
          ? { contentType: options.contentType }
          : {}),
      });
      if (!pinned.success) return pinned;
      return ok(toStored(pinned.data, options?.contentType));
    },

    async putJson(
      key: string,
      value: unknown,
      options?: PutOptions,
    ): Promise<Result<StoredObject>> {
      const pinned = await client.pinJson(value);
      if (!pinned.success) return pinned;
      return ok(toStored(pinned.data, options?.contentType ?? "application/json"));
    },

    async get(): Promise<Result<Uint8Array | null>> {
      return unsupported<Uint8Array | null>("get");
    },

    async delete(): Promise<Result<boolean>> {
      return unsupported<boolean>("delete (unpin)");
    },

    async exists(): Promise<Result<boolean>> {
      return unsupported<boolean>("exists");
    },
  };
}

function toStored(
  pin: { uri: string; cid: string; size: number; gatewayUrl: string },
  contentType: string | undefined,
): StoredObject {
  return Object.freeze({
    key: pin.cid,
    uri: pin.uri,
    size: pin.size,
    backend: "ipfs",
    url: pin.gatewayUrl,
    ...(contentType !== undefined ? { contentType } : {}),
  });
}

// Self-register on load so the generated barrel wires it up.
registerStorageAdapter("ipfs", (config) =>
  createIpfsStorageAdapter(createIpfsClient(config)),
);
