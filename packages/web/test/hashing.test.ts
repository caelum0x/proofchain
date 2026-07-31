import { describe, expect, it } from "vitest";
import { keccak256, stringToBytes } from "viem";
import { hashString, isBytes32, normalizeBytes32, sha256Hex } from "@/lib/hashing";

const VALID_BYTES32 = `0x${"a".repeat(64)}`;

describe("isBytes32", () => {
  it("accepts valid 32-byte hex", () => {
    expect(isBytes32(VALID_BYTES32)).toBe(true);
  });
  it("rejects wrong length and non-hex", () => {
    expect(isBytes32("0x1234")).toBe(false);
    expect(isBytes32("nope")).toBe(false);
    expect(isBytes32(`0x${"z".repeat(64)}`)).toBe(false);
  });
});

describe("hashString", () => {
  it("matches viem keccak256 of utf-8 bytes", () => {
    expect(hashString("hello")).toBe(keccak256(stringToBytes("hello")));
  });
  it("is deterministic and collision-free for distinct inputs", () => {
    expect(hashString("a")).toBe(hashString("a"));
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("normalizeBytes32", () => {
  it("passes through valid bytes32", () => {
    expect(normalizeBytes32(VALID_BYTES32)).toBe(VALID_BYTES32);
  });
  it("hashes non-hex references", () => {
    expect(normalizeBytes32("Coffee lot #1")).toBe(hashString("Coffee lot #1"));
  });
  it("throws on empty input", () => {
    expect(() => normalizeBytes32("   ")).toThrow();
  });
});

describe("sha256Hex", () => {
  it("computes the known digest of an empty input", async () => {
    const digest = await sha256Hex(new Uint8Array());
    expect(digest).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
  it("computes digest of bytes", async () => {
    const digest = await sha256Hex(new TextEncoder().encode("abc"));
    expect(digest).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
