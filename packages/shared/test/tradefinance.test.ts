import {
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeBillDrawn,
  decodeFactoringOffered,
  decodeGuaranteeIssued,
  decodeLetterOfCreditIssued,
} from "../src/decoders/tradefinance";
import { DecodeError, ValidationError } from "../src/errors";
import { GuaranteeType } from "../src/types/tradefinance";

// ---------------------------------------------------------------------------
// Local encoders — compose a node-style log from indexed topics + data blob.
// (Mirrors the pattern in ./helpers.ts; kept local to this domain's tests.)
// ---------------------------------------------------------------------------

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const ADDR_C = "0x3333333333333333333333333333333333333333" as const;
const ID_A =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
const ID_B =
  "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;

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

const lcIssuedAbi = [
  {
    type: "event",
    name: "Issued",
    anonymous: false,
    inputs: [
      { name: "lcId", type: "bytes32", indexed: true },
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "beneficiary", type: "address", indexed: true },
      { name: "applicant", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
] as const;

function encodeLcIssued(amount: bigint, expiry: bigint): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: lcIssuedAbi,
      eventName: "Issued",
      args: { lcId: ID_A, batchId: ID_B, beneficiary: ADDR_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint64" }],
    [ADDR_B, ADDR_C, amount, expiry],
  );
  return { topics, data };
}

const factoringOfferedAbi = [
  {
    type: "event",
    name: "Offered",
    anonymous: false,
    inputs: [
      { name: "agreementId", type: "bytes32", indexed: true },
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "faceAmount", type: "uint256", indexed: false },
      { name: "advanceRateBps", type: "uint16", indexed: false },
      { name: "feeBps", type: "uint16", indexed: false },
    ],
  },
] as const;

function encodeFactoringOffered(advanceRateBps: number, feeBps: number): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: factoringOfferedAbi,
      eventName: "Offered",
      args: { agreementId: ID_A, batchId: ID_B, seller: ADDR_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "uint16" }, { type: "uint16" }],
    [ADDR_B, 500_000n, advanceRateBps, feeBps],
  );
  return { topics, data };
}

const guaranteeIssuedAbi = [
  {
    type: "event",
    name: "Issued",
    anonymous: false,
    inputs: [
      { name: "guaranteeId", type: "bytes32", indexed: true },
      { name: "gType", type: "uint8", indexed: false },
      { name: "guarantor", type: "address", indexed: true },
      { name: "beneficiary", type: "address", indexed: true },
      { name: "principal", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
] as const;

function encodeGuaranteeIssued(gType: number): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: guaranteeIssuedAbi,
      eventName: "Issued",
      args: { guaranteeId: ID_A, guarantor: ADDR_A, beneficiary: ADDR_B },
    }),
  );
  const data = encodeAbiParameters(
    [
      { type: "uint8" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
      { type: "uint64" },
    ],
    [gType, ADDR_C, ADDR_A, 1_000_000n, 1_900_000_000n],
  );
  return { topics, data };
}

// ---------------------------------------------------------------------------

describe("decodeLetterOfCreditIssued", () => {
  it("decodes mixed indexed/data fields into a typed, frozen event", () => {
    const ev = decodeLetterOfCreditIssued(encodeLcIssued(1_000_000n, 1_888_000_000n));
    expect(ev.lcId).toBe(ID_A);
    expect(ev.batchId).toBe(ID_B);
    expect(ev.beneficiary).toBe(ADDR_A);
    expect(ev.applicant).toBe(ADDR_B);
    expect(ev.token).toBe(ADDR_C);
    expect(ev.amount).toBe(1_000_000n);
    expect(ev.expiry).toBe(1_888_000_000n);
    expect(Object.isFrozen(ev)).toBe(true);
  });

  it("throws DecodeError when handed a different contract's event", () => {
    // A Factoring `Offered` log must not decode as an LC `Issued`.
    expect(() =>
      decodeLetterOfCreditIssued(encodeFactoringOffered(9000, 150)),
    ).toThrow(DecodeError);
  });
});

describe("decodeFactoringOffered", () => {
  it("narrows uint16 rate/fee fields to JS numbers", () => {
    const ev = decodeFactoringOffered(encodeFactoringOffered(9000, 150));
    expect(ev.advanceRateBps).toBe(9000);
    expect(ev.feeBps).toBe(150);
    expect(typeof ev.advanceRateBps).toBe("number");
    expect(ev.faceAmount).toBe(500_000n);
  });
});

describe("decodeGuaranteeIssued", () => {
  it("maps a valid uint8 ordinal to the GuaranteeType enum", () => {
    const ev = decodeGuaranteeIssued(encodeGuaranteeIssued(GuaranteeType.Standby));
    expect(ev.gType).toBe(GuaranteeType.Standby);
    expect(ev.guarantor).toBe(ADDR_A);
    expect(ev.beneficiary).toBe(ADDR_B);
    expect(ev.principal).toBe(ADDR_C);
    expect(ev.amount).toBe(1_000_000n);
  });

  it("throws ValidationError for an out-of-range enum ordinal", () => {
    expect(() => decodeGuaranteeIssued(encodeGuaranteeIssued(99))).toThrow(
      ValidationError,
    );
  });
});

describe("decodeBillDrawn", () => {
  it("throws DecodeError on a structurally valid but wrong-event log", () => {
    expect(() => decodeBillDrawn(encodeLcIssued(1n, 1n))).toThrow(DecodeError);
  });
});
