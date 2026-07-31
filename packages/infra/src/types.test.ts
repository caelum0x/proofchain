import { describe, it, expect } from "vitest";
import { JobInput, VerdictInput, DealInput, Bytes32Hex, AddressHex } from "./types.js";

const B32 = `0x${"a".repeat(64)}`;
const ADDR = `0x${"b".repeat(40)}`;

describe("boundary schemas", () => {
  it("Bytes32Hex rejects uppercase / wrong length", () => {
    expect(Bytes32Hex.safeParse(B32).success).toBe(true);
    expect(Bytes32Hex.safeParse(`0x${"A".repeat(64)}`).success).toBe(false);
    expect(Bytes32Hex.safeParse("0xabc").success).toBe(false);
  });

  it("AddressHex validates 20-byte lowercase hex", () => {
    expect(AddressHex.safeParse(ADDR).success).toBe(true);
    expect(AddressHex.safeParse(B32).success).toBe(false);
  });

  it("JobInput applies defaults for status/request", () => {
    const parsed = JobInput.parse({ batchId: B32 });
    expect(parsed.status).toBe("queued");
    expect(parsed.request).toEqual({});
  });

  it("VerdictInput enforces basis-point range", () => {
    const base = {
      batchId: B32,
      passed: true,
      threshold: 7000,
      verdictHash: B32,
      model: "m",
    };
    expect(VerdictInput.safeParse({ ...base, score: 10001 }).success).toBe(false);
    expect(VerdictInput.safeParse({ ...base, score: 9600 }).success).toBe(true);
  });

  it("DealInput requires a base-10 uint256 amount string", () => {
    const base = {
      batchId: B32,
      buyer: ADDR,
      supplier: ADDR,
      token: ADDR,
      state: "funded" as const,
    };
    expect(DealInput.safeParse({ ...base, amount: "1000000" }).success).toBe(true);
    expect(DealInput.safeParse({ ...base, amount: "10.5" }).success).toBe(false);
    expect(DealInput.safeParse({ ...base, amount: -1 }).success).toBe(false);
  });
});
