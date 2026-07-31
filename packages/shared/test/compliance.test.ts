import {
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeComplianceEvaluated,
  decodeComplianceFlags,
  decodeDutyRateSet,
  decodeRecallOpened,
  decodeSanctionAddressListed,
} from "../src/decoders/compliance";
import { DecodeError, ValidationError } from "../src/errors";
import {
  ComplianceCheckFlag,
  ComplianceDecision,
  RecallSeverity,
  SanctionListSource,
} from "../src/types/compliance";

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ID_A =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
const ID_B =
  "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;
const HASH =
  "0x00000000000000000000000000000000000000000000000000000000000000cc" as const;

interface EncodedLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

function asTopics(topics: readonly (Hex | readonly Hex[] | null)[]): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") throw new Error("non-scalar topic");
    return t;
  });
}

const addressListedAbi = [
  {
    type: "event",
    name: "AddressListed",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "source", type: "uint8", indexed: false },
      { name: "reasonHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

function encodeAddressListed(source: number): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: addressListedAbi,
      eventName: "AddressListed",
      args: { account: ADDR_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint8" }, { type: "bytes32" }],
    [source, HASH],
  );
  return { topics, data };
}

const evaluatedAbi = [
  {
    type: "event",
    name: "Evaluated",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "decision", type: "uint8", indexed: false },
      { name: "failedFlags", type: "uint32", indexed: false },
    ],
  },
] as const;

function encodeEvaluated(decision: number, failedFlags: number): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: evaluatedAbi,
      eventName: "Evaluated",
      args: { batchId: ID_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint32" }],
    [decision, failedFlags],
  );
  return { topics, data };
}

const rateSetAbi = [
  {
    type: "event",
    name: "RateSet",
    anonymous: false,
    inputs: [
      { name: "hsCode", type: "bytes32", indexed: true },
      { name: "originCountry", type: "bytes32", indexed: true },
      { name: "destinationCountry", type: "bytes32", indexed: true },
      { name: "dutyBps", type: "uint16", indexed: false },
      { name: "vatBps", type: "uint16", indexed: false },
      { name: "exciseBps", type: "uint16", indexed: false },
      { name: "preferential", type: "bool", indexed: false },
    ],
  },
] as const;

function encodeRateSet(
  dutyBps: number,
  vatBps: number,
  exciseBps: number,
  preferential: boolean,
): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: rateSetAbi,
      eventName: "RateSet",
      args: { hsCode: ID_A, originCountry: ID_B, destinationCountry: HASH },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "bool" }],
    [dutyBps, vatBps, exciseBps, preferential],
  );
  return { topics, data };
}

const recallOpenedAbi = [
  {
    type: "event",
    name: "RecallOpened",
    anonymous: false,
    inputs: [
      { name: "recallId", type: "bytes32", indexed: true },
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "initiator", type: "address", indexed: true },
      { name: "severity", type: "uint8", indexed: false },
      { name: "affectedUnits", type: "uint256", indexed: false },
    ],
  },
] as const;

function encodeRecallOpened(severity: number, units: bigint): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: recallOpenedAbi,
      eventName: "RecallOpened",
      args: { recallId: ID_A, batchId: ID_B, initiator: ADDR_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint256" }],
    [severity, units],
  );
  return { topics, data };
}

// ---------------------------------------------------------------------------

describe("decodeComplianceFlags", () => {
  it("returns an empty list for a zero mask", () => {
    expect(decodeComplianceFlags(0)).toEqual([]);
  });

  it("expands a mixed mask in bit-position order", () => {
    // sanctions (1<<0) | license (1<<2) | customs (1<<4) = 0b10101 = 21
    expect(decodeComplianceFlags(0b10101)).toEqual([
      ComplianceCheckFlag.Sanctions,
      ComplianceCheckFlag.License,
      ComplianceCheckFlag.Customs,
    ]);
  });

  it("expands the all-set mask to every flag", () => {
    expect(decodeComplianceFlags(0b11111)).toEqual([
      ComplianceCheckFlag.Sanctions,
      ComplianceCheckFlag.Aml,
      ComplianceCheckFlag.License,
      ComplianceCheckFlag.Certificate,
      ComplianceCheckFlag.Customs,
    ]);
  });

  it("throws on an unknown high bit (data drift guard)", () => {
    expect(() => decodeComplianceFlags(1 << 5)).toThrow(ValidationError);
  });

  it("throws on a negative or non-integer mask", () => {
    expect(() => decodeComplianceFlags(-1)).toThrow(ValidationError);
    expect(() => decodeComplianceFlags(1.5)).toThrow(ValidationError);
  });
});

describe("decodeComplianceEvaluated", () => {
  it("decodes the decision enum and expands failed flags", () => {
    const ev = decodeComplianceEvaluated(
      encodeEvaluated(ComplianceDecision.Blocked, 0b10010),
    );
    expect(ev.batchId).toBe(ID_A);
    expect(ev.decision).toBe(ComplianceDecision.Blocked);
    expect(ev.failedFlags).toBe(0b10010);
    expect(ev.failed).toEqual([
      ComplianceCheckFlag.Aml,
      ComplianceCheckFlag.Customs,
    ]);
  });

  it("throws ValidationError on an invalid decision ordinal", () => {
    expect(() => decodeComplianceEvaluated(encodeEvaluated(9, 0))).toThrow(
      ValidationError,
    );
  });
});

describe("decodeSanctionAddressListed", () => {
  it("maps the uint8 source ordinal to the enum", () => {
    const ev = decodeSanctionAddressListed(encodeAddressListed(SanctionListSource.OFAC));
    expect(ev.account).toBe(ADDR_A);
    expect(ev.source).toBe(SanctionListSource.OFAC);
    expect(ev.reasonHash).toBe(HASH);
  });

  it("throws ValidationError for an out-of-range source", () => {
    expect(() => decodeSanctionAddressListed(encodeAddressListed(42))).toThrow(
      ValidationError,
    );
  });
});

describe("decodeDutyRateSet", () => {
  it("narrows uint16 rates to numbers and decodes the bool flag", () => {
    const ev = decodeDutyRateSet(encodeRateSet(500, 2000, 0, true));
    expect(ev.dutyBps).toBe(500);
    expect(ev.vatBps).toBe(2000);
    expect(ev.exciseBps).toBe(0);
    expect(ev.preferential).toBe(true);
    expect(ev.hsCode).toBe(ID_A);
  });
});

describe("decodeRecallOpened", () => {
  it("decodes severity and unit count", () => {
    const ev = decodeRecallOpened(encodeRecallOpened(RecallSeverity.ClassI, 4200n));
    expect(ev.severity).toBe(RecallSeverity.ClassI);
    expect(ev.affectedUnits).toBe(4200n);
    expect(ev.initiator).toBe(ADDR_A);
  });

  it("throws DecodeError when given a different event", () => {
    expect(() => decodeRecallOpened(encodeAddressListed(1))).toThrow(DecodeError);
  });
});
