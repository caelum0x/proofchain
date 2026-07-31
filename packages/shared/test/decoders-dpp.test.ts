import {
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeDppComplianceEvaluated,
  decodeLifecycleRecorded,
  decodePassportIssued,
  decodePassportStatusChanged,
} from "../src/decoders/dpp";
import { ComplianceVerdict, LifecycleEventType } from "../src/types/dpp";

// ---------------------------------------------------------------------------
// Local fixtures + encoders (mirror test/helpers.ts: node emits a log as
// indexed topics via encodeEventTopics + non-indexed data via encodeAbiParameters).
// ---------------------------------------------------------------------------
const hex32 = (b: string): Hex => `0x${b.repeat(32)}` as Hex;
const MFR = "0x3333333333333333333333333333333333333333" as const;
const BATCH = hex32("aa");
const GTIN = hex32("bb");
const PROFILE = hex32("cc");
const DATA_HASH = hex32("dd");

const asScalar = (t: Hex | readonly Hex[] | null): Hex => {
  if (typeof t !== "string") throw new Error("non-scalar topic in fixture");
  return t;
};

const passportIssuedAbi = [
  {
    type: "event",
    name: "PassportIssued",
    anonymous: false,
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "manufacturer", type: "address", indexed: true },
      { name: "gtin", type: "bytes32", indexed: false },
    ],
  },
] as const;

const evaluatedAbi = [
  {
    type: "event",
    name: "Evaluated",
    anonymous: false,
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "regulationProfile", type: "bytes32", indexed: true },
      { name: "score", type: "uint16", indexed: false },
      { name: "verdict", type: "uint8", indexed: false },
    ],
  },
] as const;

const lifecycleAbi = [
  {
    type: "event",
    name: "LifecycleRecorded",
    anonymous: false,
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "eventType", type: "uint8", indexed: false },
      { name: "actor", type: "address", indexed: true },
      { name: "dataHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

function encodePassportIssued(tokenId: bigint) {
  const topics = encodeEventTopics({
    abi: passportIssuedAbi,
    eventName: "PassportIssued",
    args: { tokenId, batchId: BATCH, manufacturer: MFR },
  }).map(asScalar);
  const data = encodeAbiParameters([{ type: "bytes32" }], [GTIN]);
  return { topics, data };
}

function encodeEvaluated(score: number, verdict: number) {
  const topics = encodeEventTopics({
    abi: evaluatedAbi,
    eventName: "Evaluated",
    args: { tokenId: 7n, regulationProfile: PROFILE },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "uint16" }, { type: "uint8" }],
    [score, verdict],
  );
  return { topics, data };
}

function encodeLifecycle(index: bigint, eventType: number) {
  const topics = encodeEventTopics({
    abi: lifecycleAbi,
    eventName: "LifecycleRecorded",
    args: { tokenId: 7n, index, actor: MFR },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "uint8" }, { type: "bytes32" }],
    [eventType, DATA_HASH],
  );
  return { topics, data };
}

describe("decodePassportIssued", () => {
  it("decodes a well-formed PassportIssued log", () => {
    const decoded = decodePassportIssued(encodePassportIssued(7n));
    expect(decoded).not.toBeNull();
    expect(decoded?.tokenId).toBe(7n);
    expect(decoded?.batchId).toBe(BATCH);
    expect(decoded?.manufacturer).toBe(MFR);
    expect(decoded?.gtin).toBe(GTIN);
  });

  it("returns null for a different event of the same contract", () => {
    expect(decodePassportStatusChanged(encodePassportIssued(7n))).toBeNull();
  });
});

describe("decodeDppComplianceEvaluated", () => {
  it("maps the verdict enum and bps score", () => {
    const decoded = decodeDppComplianceEvaluated(
      encodeEvaluated(8800, ComplianceVerdict.Conditional),
    );
    expect(decoded?.tokenId).toBe(7n);
    expect(decoded?.regulationProfile).toBe(PROFILE);
    expect(decoded?.score).toBe(8800);
    expect(decoded?.verdict).toBe(ComplianceVerdict.Conditional);
  });
});

describe("decodeLifecycleRecorded", () => {
  it("decodes the indexed uint index and eventType enum", () => {
    const decoded = decodeLifecycleRecorded(
      encodeLifecycle(2n, LifecycleEventType.Repaired),
    );
    expect(decoded?.tokenId).toBe(7n);
    expect(decoded?.index).toBe(2n);
    expect(decoded?.eventType).toBe(LifecycleEventType.Repaired);
    expect(decoded?.actor).toBe(MFR);
    expect(decoded?.dataHash).toBe(DATA_HASH);
  });
});
