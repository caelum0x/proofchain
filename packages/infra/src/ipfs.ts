/**
 * IPFS pinning with a Pinata backend and a local mock fallback.
 *
 * When `PINATA_JWT` is configured, `pinJson` / `pinFile` upload to Pinata and
 * return the real `ipfs://<cid>` URI. When it is NOT configured, they degrade
 * gracefully to a deterministic local mock — `ipfs://mock/<sha256>` — so the
 * whole system runs end-to-end without any external account or network call.
 *
 * All operations return a `Result<PinResult>`; network/HTTP failures are
 * captured into a structured error envelope and never thrown across the API.
 */
import { z } from "zod";
import { loadInfraConfig, type InfraConfig } from "./env.js";
import { InfraErrorCode, ok, err, toEnvelope, type Result } from "./errors.js";
import { sha256Hex, canonicalJson } from "./hash.js";

export type PinBackend = "pinata" | "local";

export interface PinResult {
  /** ipfs:// URI. Real CID on Pinata; `ipfs://mock/<sha256>` on local fallback. */
  readonly uri: string;
  /** Content identifier (Pinata CID) or the sha256 for the local mock. */
  readonly cid: string;
  /** Size in bytes of the pinned payload. */
  readonly size: number;
  /** Which backend produced this result. */
  readonly backend: PinBackend;
  /** Convenience HTTPS gateway URL for the content. */
  readonly gatewayUrl: string;
}

export interface PinFileOptions {
  /** Suggested filename recorded in Pinata metadata. */
  readonly name?: string;
  /** MIME content type for the multipart part. */
  readonly contentType?: string;
}

export interface IpfsClient {
  readonly backend: PinBackend;
  pinJson(value: unknown): Promise<Result<PinResult>>;
  pinFile(data: Uint8Array, options?: PinFileOptions): Promise<Result<PinResult>>;
}

/** Shape of Pinata's pin endpoints response (only the fields we rely on). */
const PinataResponse = z.object({
  IpfsHash: z.string().min(1),
  PinSize: z.number().optional(),
});

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Create an IPFS client. Backend is chosen from the resolved config: Pinata
 * when a JWT is present, local mock otherwise.
 */
export function createIpfsClient(
  config: InfraConfig = loadInfraConfig(),
): IpfsClient {
  const { ipfs } = config;

  if (!ipfs.configured || ipfs.jwt === undefined) {
    return createLocalClient(ipfs.gatewayUrl);
  }
  return createPinataClient(ipfs.jwt, ipfs.apiUrl, ipfs.gatewayUrl);
}

// -----------------------------------------------------------------------------
// Local mock backend
// -----------------------------------------------------------------------------

function createLocalClient(gatewayUrl: string): IpfsClient {
  return {
    backend: "local",
    async pinJson(value: unknown): Promise<Result<PinResult>> {
      try {
        // Hash the canonical form so key ordering never changes the digest, and
        // derive the reported size from the exact bytes we hashed.
        const bytes = new TextEncoder().encode(canonicalJson(value));
        const digest = sha256Hex(bytes);
        return ok(mockResult(digest, bytes.byteLength, gatewayUrl));
      } catch (error) {
        return err(InfraErrorCode.IPFS, "Failed to serialize JSON for pinning", {
          cause: toEnvelope(error),
        });
      }
    },
    async pinFile(data: Uint8Array): Promise<Result<PinResult>> {
      const validation = validateBytes(data);
      if (validation !== null) return validation;
      const digest = sha256Hex(data);
      return ok(mockResult(digest, data.byteLength, gatewayUrl));
    },
  };
}

function mockResult(
  digest: string,
  size: number,
  gatewayUrl: string,
): PinResult {
  const cid = `mock/${digest}`;
  return Object.freeze({
    uri: `ipfs://${cid}`,
    cid,
    size,
    backend: "local" as const,
    gatewayUrl: `${gatewayUrl}/${cid}`,
  });
}

// -----------------------------------------------------------------------------
// Pinata backend
// -----------------------------------------------------------------------------

function createPinataClient(
  jwt: string,
  apiUrl: string,
  gatewayUrl: string,
): IpfsClient {
  const authHeader = `Bearer ${jwt}`;

  return {
    backend: "pinata",
    async pinJson(value: unknown): Promise<Result<PinResult>> {
      let body: string;
      try {
        body = JSON.stringify({ pinataContent: value });
      } catch (error) {
        return err(InfraErrorCode.IPFS, "Failed to serialize JSON for pinning", {
          cause: toEnvelope(error),
        });
      }
      return request(
        `${apiUrl}/pinning/pinJSONToIPFS`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body,
        },
        gatewayUrl,
      );
    },
    async pinFile(
      data: Uint8Array,
      options?: PinFileOptions,
    ): Promise<Result<PinResult>> {
      const validation = validateBytes(data);
      if (validation !== null) return validation;

      const form = new FormData();
      const name = options?.name ?? "file.bin";
      const type = options?.contentType ?? "application/octet-stream";
      // Copy into a fresh ArrayBuffer so Blob gets a clean, correctly-sized view.
      const buffer = data.slice().buffer;
      form.append("file", new Blob([buffer], { type }), name);
      form.append(
        "pinataMetadata",
        JSON.stringify({ name }),
      );

      return request(
        `${apiUrl}/pinning/pinFileToIPFS`,
        {
          method: "POST",
          headers: { Authorization: authHeader },
          body: form,
        },
        gatewayUrl,
      );
    },
  };
}

async function request(
  url: string,
  init: RequestInit,
  gatewayUrl: string,
): Promise<Result<PinResult>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();

    if (!response.ok) {
      return err(InfraErrorCode.IPFS, "Pinata request failed", {
        status: response.status,
        statusText: response.statusText,
        body: truncate(text, 500),
      });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return err(InfraErrorCode.IPFS, "Pinata returned non-JSON response", {
        body: truncate(text, 500),
      });
    }

    const parsed = PinataResponse.safeParse(parsedJson);
    if (!parsed.success) {
      return err(InfraErrorCode.IPFS, "Unexpected Pinata response shape", {
        issues: parsed.error.issues,
      });
    }

    const cid = parsed.data.IpfsHash;
    return ok(
      Object.freeze({
        uri: `ipfs://${cid}`,
        cid,
        size: parsed.data.PinSize ?? 0,
        backend: "pinata" as const,
        gatewayUrl: `${gatewayUrl}/${cid}`,
      }),
    );
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return err(
      aborted ? InfraErrorCode.NETWORK : InfraErrorCode.IPFS,
      aborted ? "Pinata request timed out" : "Pinata request errored",
      { cause: toEnvelope(error) },
    );
  } finally {
    clearTimeout(timeout);
  }
}

// -----------------------------------------------------------------------------
// Convenience module-level helpers (use env-derived default client)
// -----------------------------------------------------------------------------

/** Pin a JSON-serializable object using the env-configured backend. */
export function pinJson(value: unknown): Promise<Result<PinResult>> {
  return createIpfsClient().pinJson(value);
}

/** Pin raw bytes using the env-configured backend. */
export function pinFile(
  data: Uint8Array,
  options?: PinFileOptions,
): Promise<Result<PinResult>> {
  return createIpfsClient().pinFile(data, options);
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function validateBytes(data: Uint8Array): Result<PinResult> | null {
  if (!(data instanceof Uint8Array)) {
    return err(InfraErrorCode.VALIDATION, "pinFile expects a Uint8Array");
  }
  if (data.byteLength === 0) {
    return err(InfraErrorCode.VALIDATION, "pinFile received empty data");
  }
  return null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
