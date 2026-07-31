/**
 * Minimal AWS Signature Version 4 signer (S3 / R2 compatible), implemented with
 * `node:crypto` so the S3 storage adapter needs no SDK dependency.
 *
 * Only the subset required to sign S3 object requests is implemented, but it is
 * a faithful implementation: it reproduces the canonical AWS SigV4 test vectors
 * (see `sigv4.test.ts`). All inputs are explicit and injectable so signing is
 * fully deterministic and unit-testable offline.
 */
import { createHash, createHmac } from "node:crypto";

export interface SignInput {
  readonly method: string;
  /** Full request URL (scheme + host + path + optional query). */
  readonly url: string;
  readonly region: string;
  /** AWS service name; "s3" for object storage. */
  readonly service: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** Additional headers to sign (names are lowercased). `host` is derived. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Hex sha256 of the request body (or "UNSIGNED-PAYLOAD"). */
  readonly payloadHash: string;
  /** Fixed request time — injected for deterministic testing. */
  readonly date: Date;
}

export interface SignResult {
  /** The full set of headers to send, including `Authorization`. */
  readonly headers: Record<string, string>;
  /** The `Authorization` header value. */
  readonly authorization: string;
  /** `YYYYMMDDTHHMMSSZ` amz date. */
  readonly amzDate: string;
  /** `;`-joined sorted signed header names. */
  readonly signedHeaders: string;
}

const ALGORITHM = "AWS4-HMAC-SHA256";

/** Compute the hex sha256 of a payload — used for the content hash header. */
export function hashPayload(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Sign a request and return the headers to send. Never mutates its inputs. */
export function signRequest(input: SignInput): SignResult {
  const url = new URL(input.url);
  const amzDate = formatAmzDate(input.date);
  const dateStamp = amzDate.slice(0, 8);

  const baseHeaders: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate,
    ...lowerKeys(input.headers ?? {}),
  };

  const sortedHeaderNames = Object.keys(baseHeaders).sort();
  const canonicalHeaders =
    sortedHeaderNames
      .map((name) => `${name}:${collapseSpaces(baseHeaders[name] ?? "")}`)
      .join("\n") + "\n";
  const signedHeaders = sortedHeaderNames.join(";");

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(url.pathname),
    canonicalQuery(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const signingKey = deriveSigningKey(
    input.secretAccessKey,
    dateStamp,
    input.region,
    input.service,
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `${ALGORITHM} Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: { ...baseHeaders, Authorization: authorization },
    authorization,
    amzDate,
    signedHeaders,
  };
}

// -----------------------------------------------------------------------------
// internals
// -----------------------------------------------------------------------------

function deriveSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
}

function canonicalUri(pathname: string): string {
  if (pathname === "" || pathname === "/") return "/";
  return pathname
    .split("/")
    .map((segment) => rfc3986(decodeURIComponent(segment)))
    .join("/");
}

function canonicalQuery(params: URLSearchParams): string {
  const pairs: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    pairs.push([rfc3986(key), rfc3986(value)]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

/** RFC 3986 percent-encoding (AWS-compatible: unreserved chars pass through). */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function lowerKeys(headers: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}
