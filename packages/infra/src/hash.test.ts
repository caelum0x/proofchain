import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { sha256Hex, sha256Json, canonicalJson } from "./hash.js";

describe("hash helpers", () => {
  it("sha256Hex matches node crypto for known input", () => {
    const bytes = new TextEncoder().encode("abc");
    const expected = createHash("sha256").update(bytes).digest("hex");
    expect(sha256Hex(bytes)).toBe(expected);
    // Well-known sha256("abc")
    expect(sha256Hex(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("canonicalJson sorts keys deterministically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it("canonicalJson recurses into nested objects and arrays", () => {
    expect(canonicalJson({ z: [{ y: 1, x: 2 }], a: 1 })).toBe(
      '{"a":1,"z":[{"x":2,"y":1}]}',
    );
  });

  it("canonicalJson drops undefined values", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("sha256Json is stable across key ordering", () => {
    expect(sha256Json({ a: 1, b: 2 })).toBe(sha256Json({ b: 2, a: 1 }));
  });
});
