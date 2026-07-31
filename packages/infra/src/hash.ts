/**
 * Deterministic hashing helpers used by the IPFS local fallback.
 */
import { createHash } from "node:crypto";

/** Lowercase hex sha256 of a byte buffer. */
export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Canonical JSON serialization with deterministic key ordering so the same
 * logical object always hashes to the same digest regardless of key insertion
 * order. Undefined values are dropped (matching JSON.stringify semantics).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = sortValue(v);
    }
    return out;
  }
  return value;
}

/** sha256 hex of a JSON-serializable object using canonical key ordering. */
export function sha256Json(value: unknown): string {
  return sha256Hex(new TextEncoder().encode(canonicalJson(value)));
}
