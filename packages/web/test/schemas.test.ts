import { describe, expect, it } from "vitest";
import {
  addCheckpointSchema,
  faucetSchema,
  fundDealSchema,
  registerBatchSchema,
  validateDocumentFile,
  verifyRequestSchema,
} from "@/lib/schemas";

const ADDR = `0x${"1".repeat(40)}`;
const BYTES32 = `0x${"a".repeat(64)}`;

describe("registerBatchSchema", () => {
  it("accepts valid input", () => {
    const r = registerBatchSchema.safeParse({
      reference: "Lot A",
      origin: "Farm",
      metadataURI: "ipfs://Qm",
    });
    expect(r.success).toBe(true);
  });
  it("rejects invalid metadata uri", () => {
    const r = registerBatchSchema.safeParse({
      reference: "Lot A",
      origin: "Farm",
      metadataURI: "not-a-uri",
    });
    expect(r.success).toBe(false);
  });
  it("rejects empty reference", () => {
    const r = registerBatchSchema.safeParse({ reference: "", origin: "F", metadataURI: "ipfs://Q" });
    expect(r.success).toBe(false);
  });
});

describe("addCheckpointSchema", () => {
  it("accepts valid input", () => {
    const r = addCheckpointSchema.safeParse({
      batchId: "Lot A",
      location: "Port",
      occurredAt: "2026-01-01T10:00",
      dataReference: "BoL",
    });
    expect(r.success).toBe(true);
  });
  it("rejects invalid date", () => {
    const r = addCheckpointSchema.safeParse({
      batchId: "Lot A",
      location: "Port",
      occurredAt: "not-a-date",
      dataReference: "BoL",
    });
    expect(r.success).toBe(false);
  });
});

describe("fundDealSchema", () => {
  it("accepts valid input", () => {
    const r = fundDealSchema.safeParse({ batchId: BYTES32, supplier: ADDR, amount: "100" });
    expect(r.success).toBe(true);
  });
  it("rejects bad address", () => {
    const r = fundDealSchema.safeParse({ batchId: BYTES32, supplier: "0xnope", amount: "100" });
    expect(r.success).toBe(false);
  });
  it("rejects non-positive amount", () => {
    const r = fundDealSchema.safeParse({ batchId: BYTES32, supplier: ADDR, amount: "-1" });
    expect(r.success).toBe(false);
  });
});

describe("verifyRequestSchema", () => {
  it("requires a bytes32 batch id", () => {
    expect(verifyRequestSchema.safeParse({ batchId: BYTES32 }).success).toBe(true);
    expect(verifyRequestSchema.safeParse({ batchId: "Lot A" }).success).toBe(false);
  });
});

describe("faucetSchema", () => {
  it("validates amount", () => {
    expect(faucetSchema.safeParse({ amount: "1000" }).success).toBe(true);
    expect(faucetSchema.safeParse({ amount: "0" }).success).toBe(false);
  });
});

describe("validateDocumentFile", () => {
  const makeFile = (name: string, type: string, size: number): File => {
    const blob = new Blob([new Uint8Array(size)], { type });
    return new File([blob], name, { type });
  };

  it("accepts a valid pdf", () => {
    expect(validateDocumentFile(makeFile("a.pdf", "application/pdf", 1000))).toBeNull();
  });
  it("rejects empty files", () => {
    expect(validateDocumentFile(makeFile("a.pdf", "application/pdf", 0))).toMatch(/empty/);
  });
  it("rejects unsupported types", () => {
    expect(validateDocumentFile(makeFile("a.txt", "text/plain", 100))).toMatch(/unsupported/);
  });
});
