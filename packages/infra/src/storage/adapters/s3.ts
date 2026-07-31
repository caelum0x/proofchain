/**
 * S3 / R2-compatible storage adapter.
 *
 * Speaks the S3 REST API directly, signing every request with AWS SigV4
 * (`../sigv4.ts`) — no AWS SDK dependency. Works with AWS S3, Cloudflare R2,
 * MinIO and any S3-compatible endpoint via `S3_ENDPOINT`.
 *
 * When S3 is not configured it transparently DELEGATES to the local in-memory
 * adapter, so callers get a working blob store offline with zero branching.
 *
 * `fetch` and the clock are injectable for fully offline, deterministic tests.
 *
 * Registered under the name "s3".
 */
import type { InfraConfig } from "../../env.js";
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../../errors.js";
import { registerStorageAdapter } from "../registry.js";
import { signRequest, hashPayload } from "../sigv4.js";
import type { PutOptions, StorageAdapter, StoredObject } from "../types.js";
import { createLocalStorageAdapter } from "./local.js";

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface S3Deps {
  readonly fetch?: FetchFn;
  readonly now?: () => Date;
}

interface S3Settings {
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly endpoint: string;
  readonly publicUrl?: string;
}

const REQUEST_TIMEOUT_MS = 30_000;
const EMPTY_PAYLOAD_HASH = hashPayload(new Uint8Array());

/**
 * Build an S3 adapter from config. Falls back to the local adapter when S3 is
 * not configured, so the return value is always a usable `StorageAdapter`.
 */
export function createS3StorageAdapter(
  config: InfraConfig,
  deps: S3Deps = {},
): StorageAdapter {
  if (!config.s3.configured) {
    return createLocalStorageAdapter();
  }
  const settings: S3Settings = config.s3;
  const doFetch: FetchFn = deps.fetch ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? (() => new Date());

  const objectUrl = (key: string): string =>
    `${settings.endpoint}/${settings.bucket}/${encodeKey(key)}`;

  async function send(
    method: string,
    key: string,
    body: Uint8Array | undefined,
    contentType: string | undefined,
  ): Promise<Result<Response>> {
    const url = objectUrl(key);
    const payloadHash = body === undefined ? EMPTY_PAYLOAD_HASH : hashPayload(body);
    const extraHeaders: Record<string, string> =
      contentType !== undefined ? { "content-type": contentType } : {};
    const signed = signRequest({
      method,
      url,
      region: settings.region,
      service: "s3",
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
      headers: extraHeaders,
      payloadHash,
      date: now(),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const init: RequestInit = {
        method,
        headers: signed.headers,
        signal: controller.signal,
      };
      if (body !== undefined) init.body = body.slice();
      const response = await doFetch(url, init);
      return ok(response);
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return err(
        aborted ? InfraErrorCode.NETWORK : InfraErrorCode.UNEXPECTED,
        aborted ? "S3 request timed out" : "S3 request errored",
        { cause: toEnvelope(error), method, key },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  function stored(key: string, size: number, contentType?: string): StoredObject {
    return Object.freeze({
      key,
      uri: `s3://${settings.bucket}/${key}`,
      size,
      backend: "s3",
      url:
        settings.publicUrl !== undefined
          ? `${settings.publicUrl}/${encodeKey(key)}`
          : objectUrl(key),
      ...(contentType !== undefined ? { contentType } : {}),
    });
  }

  return {
    backend: "s3",

    async put(
      key: string,
      data: Uint8Array,
      options?: PutOptions,
    ): Promise<Result<StoredObject>> {
      const contentType = options?.contentType ?? "application/octet-stream";
      const res = await send("PUT", key, data, contentType);
      if (!res.success) return res;
      if (!res.data.ok) return httpErr("put", key, res.data);
      return ok(stored(key, data.byteLength, contentType));
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
      return this.put(key, bytes, { contentType: "application/json", ...options });
    },

    async get(key: string): Promise<Result<Uint8Array | null>> {
      const res = await send("GET", key, undefined, undefined);
      if (!res.success) return res;
      if (res.data.status === 404) return ok<Uint8Array | null>(null);
      if (!res.data.ok) return httpErr("get", key, res.data);
      const buffer = await res.data.arrayBuffer();
      return ok<Uint8Array | null>(new Uint8Array(buffer));
    },

    async delete(key: string): Promise<Result<boolean>> {
      const res = await send("DELETE", key, undefined, undefined);
      if (!res.success) return res;
      // S3 returns 204 on delete and 204 even when the key was absent.
      if (!res.data.ok && res.data.status !== 404) return httpErr("delete", key, res.data);
      return ok(true);
    },

    async exists(key: string): Promise<Result<boolean>> {
      const res = await send("HEAD", key, undefined, undefined);
      if (!res.success) return res;
      if (res.data.status === 404) return ok(false);
      if (!res.data.ok) return httpErr("exists", key, res.data);
      return ok(true);
    },
  };
}

function httpErr<T>(op: string, key: string, response: Response): Result<T> {
  return err<T>(InfraErrorCode.UNEXPECTED, `S3 ${op} failed`, {
    key,
    status: response.status,
    statusText: response.statusText,
  });
}

/** Encode each path segment of a key while preserving `/` separators. */
function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

// Self-register on load so the generated barrel wires it up.
registerStorageAdapter("s3", (config) => createS3StorageAdapter(config));
