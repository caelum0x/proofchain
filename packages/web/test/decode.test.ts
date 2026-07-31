import { describe, expect, it } from "vitest";
import {
  decodeAttestation,
  decodeBatch,
  decodeCheckpoints,
  decodeDeal,
} from "@/lib/decode";
import { DealState } from "@/lib/types";

const ADDR = `0x${"1".repeat(40)}` as const;
const B32 = `0x${"a".repeat(64)}` as const;

describe("decodeBatch", () => {
  it("narrows bigint timestamp to number", () => {
    const view = decodeBatch({
      batchId: B32,
      supplier: ADDR,
      originHash: B32,
      metadataURI: "ipfs://x",
      createdAt: 1_700_000_000n,
      exists: true,
    });
    expect(view.createdAt).toBe(1_700_000_000);
    expect(view.exists).toBe(true);
  });
});

describe("decodeCheckpoints", () => {
  it("maps an array", () => {
    const views = decodeCheckpoints([
      { batchId: B32, location: "Port", timestamp: 100n, dataHash: B32 },
    ]);
    expect(views).toHaveLength(1);
    expect(views[0]?.timestamp).toBe(100);
  });
});

describe("decodeAttestation", () => {
  it("preserves score", () => {
    const view = decodeAttestation({
      batchId: B32,
      score: 9600,
      verdictHash: B32,
      verdictURI: "ipfs://v",
      attestedAt: 5n,
      agent: ADDR,
      exists: true,
    });
    expect(view.score).toBe(9600);
    expect(view.attestedAt).toBe(5);
  });
});

describe("decodeDeal", () => {
  it("coerces known state", () => {
    const view = decodeDeal({
      batchId: B32,
      buyer: ADDR,
      supplier: ADDR,
      token: ADDR,
      amount: 1000n,
      state: 2,
    });
    expect(view.state).toBe(DealState.Released);
    expect(view.amount).toBe(1000n);
  });
  it("defaults unknown state to None", () => {
    const view = decodeDeal({
      batchId: B32,
      buyer: ADDR,
      supplier: ADDR,
      token: ADDR,
      amount: 0n,
      state: 99,
    });
    expect(view.state).toBe(DealState.None);
  });
});
