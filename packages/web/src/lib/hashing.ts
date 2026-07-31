import { keccak256, stringToBytes, type Hex } from "viem";

/**
 * Deterministic hashing helpers. Users type human-readable references (a batch
 * label, an origin descriptor, a document); we derive the on-chain bytes32 ids
 * from them so the UI never asks a human to hand-craft a 32-byte hex value.
 */

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export function isBytes32(value: string): value is Hex {
  return BYTES32_RE.test(value);
}

/** keccak256 of a UTF-8 string → bytes32. */
export function hashString(value: string): Hex {
  return keccak256(stringToBytes(value));
}

/**
 * Accept either a raw bytes32 hex value or an arbitrary reference string.
 * Raw hex is used as-is; anything else is keccak256-hashed. This lets suppliers
 * paste an existing batch id OR type a friendly label.
 */
export function normalizeBytes32(input: string): Hex {
  const trimmed = input.trim();
  if (isBytes32(trimmed)) return trimmed as Hex;
  if (trimmed.length === 0) {
    throw new Error("Cannot hash an empty value.");
  }
  return hashString(trimmed);
}

/** SHA-256 of arbitrary bytes → lowercase hex string (no 0x prefix). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof Uint8Array ? bufferOf(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHexString(new Uint8Array(digest));
}

/** SHA-256 of a File's contents → hex string. */
export async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256Hex(buf);
}

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  // Copy into a standalone ArrayBuffer to satisfy the WebCrypto BufferSource type.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHexString(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}
