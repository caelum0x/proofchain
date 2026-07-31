import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeEmissionsPeriodOpened,
  decodeGreenBondCreated,
  decodeRecCertificateIssued,
  EnergySource,
} from "../src";
import { ValidationError } from "../src/errors";

// ---------------------------------------------------------------------------
// Local encoders — compose a raw log exactly as a node emits it (indexed args
// in topics via encodeEventTopics, the rest in data via encodeAbiParameters).
// ---------------------------------------------------------------------------

function asTopics(topics: readonly (Hex | readonly Hex[] | null)[]): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") throw new Error("non-scalar topic in fixture");
    return t;
  });
}

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const ID_A =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
const ID_B =
  "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;

const certificateIssuedAbi = [
  {
    type: "event",
    name: "CertificateIssued",
    anonymous: false,
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "facilityId", type: "bytes32", indexed: true },
      { name: "source", type: "uint8", indexed: false },
      { name: "vintageYear", type: "uint16", indexed: false },
      { name: "mwh", type: "uint256", indexed: false },
    ],
  },
] as const;

function encodeCertificateIssued(source: number): {
  topics: Hex[];
  data: Hex;
} {
  const topics = asTopics(
    encodeEventTopics({
      abi: certificateIssuedAbi,
      eventName: "CertificateIssued",
      args: { tokenId: 7n, facilityId: ID_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint16" }, { type: "uint256" }],
    [source, 2026, 1_500n],
  );
  return { topics, data };
}

const certificateRetiredAbi = [
  {
    type: "event",
    name: "CertificateRetired",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "mwh", type: "uint256", indexed: false },
      { name: "beneficiary", type: "bytes32", indexed: false },
    ],
  },
] as const;

function encodeCertificateRetired(): { topics: Hex[]; data: Hex } {
  const topics = asTopics(
    encodeEventTopics({
      abi: certificateRetiredAbi,
      eventName: "CertificateRetired",
      args: { account: ADDR_A, tokenId: 7n },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes32" }],
    [500n, ID_B],
  );
  return { topics, data };
}

const periodOpenedAbi = [
  {
    type: "event",
    name: "PeriodOpened",
    anonymous: false,
    inputs: [
      { name: "periodId", type: "bytes32", indexed: true },
      { name: "cap", type: "uint256", indexed: false },
      { name: "startsAt", type: "uint64", indexed: false },
      { name: "endsAt", type: "uint64", indexed: false },
    ],
  },
] as const;

function encodePeriodOpened(): { topics: Hex[]; data: Hex } {
  const topics = asTopics(
    encodeEventTopics({
      abi: periodOpenedAbi,
      eventName: "PeriodOpened",
      args: { periodId: ID_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint64" }, { type: "uint64" }],
    [1_000_000n, 1_700_000_000n, 1_800_000_000n],
  );
  return { topics, data };
}

const bondCreatedAbi = [
  {
    type: "event",
    name: "BondCreated",
    anonymous: false,
    inputs: [
      { name: "bondId", type: "bytes32", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "principalTarget", type: "uint256", indexed: false },
      { name: "couponBps", type: "uint16", indexed: false },
      { name: "greenCategory", type: "bytes32", indexed: false },
    ],
  },
] as const;

function encodeBondCreated(): { topics: Hex[]; data: Hex } {
  const topics = asTopics(
    encodeEventTopics({
      abi: bondCreatedAbi,
      eventName: "BondCreated",
      args: { bondId: ID_A, issuer: ADDR_A },
    }),
  );
  const data = encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "uint16" },
      { type: "bytes32" },
    ],
    [ADDR_B, 5_000_000n, 450, ID_B],
  );
  return { topics, data };
}

// ---------------------------------------------------------------------------

describe("decodeRecCertificateIssued", () => {
  it("decodes an issued REC with a branded enum source", () => {
    const decoded = decodeRecCertificateIssued(
      encodeCertificateIssued(EnergySource.Wind),
    );
    expect(decoded).not.toBeNull();
    expect(decoded?.tokenId).toBe(7n);
    expect(decoded?.facilityId).toBe(ID_A);
    expect(decoded?.source).toBe(EnergySource.Wind);
    expect(decoded?.vintageYear).toBe(2026);
    expect(decoded?.mwh).toBe(1_500n);
  });

  it("returns null for a different event of the same contract", () => {
    expect(decodeRecCertificateIssued(encodeCertificateRetired())).toBeNull();
  });

  it("throws ValidationError on an out-of-range enum value", () => {
    expect(() => decodeRecCertificateIssued(encodeCertificateIssued(99))).toThrow(
      ValidationError,
    );
  });

  it("throws ValidationError on structurally invalid input", () => {
    expect(() =>
      decodeRecCertificateIssued({ topics: "nope", data: "0x" }),
    ).toThrow(ValidationError);
  });
});

describe("decodeEmissionsPeriodOpened", () => {
  it("decodes bigint uint64/uint256 fields", () => {
    const decoded = decodeEmissionsPeriodOpened(encodePeriodOpened());
    expect(decoded?.periodId).toBe(ID_A);
    expect(decoded?.cap).toBe(1_000_000n);
    expect(decoded?.startsAt).toBe(1_700_000_000n);
    expect(decoded?.endsAt).toBe(1_800_000_000n);
  });

  it("returns null for an unrelated log", () => {
    expect(decodeEmissionsPeriodOpened(encodeBondCreated())).toBeNull();
  });
});

describe("decodeGreenBondCreated", () => {
  it("decodes address, uint256 and uint16 fields", () => {
    const decoded = decodeGreenBondCreated(encodeBondCreated());
    expect(decoded?.bondId).toBe(ID_A);
    expect(decoded?.issuer).toBe(getAddress(ADDR_A));
    expect(decoded?.token).toBe(getAddress(ADDR_B));
    expect(decoded?.principalTarget).toBe(5_000_000n);
    expect(decoded?.couponBps).toBe(450);
    expect(decoded?.greenCategory).toBe(ID_B);
  });

  it("returns a frozen, immutable result", () => {
    const decoded = decodeGreenBondCreated(encodeBondCreated());
    expect(Object.isFrozen(decoded)).toBe(true);
  });
});
