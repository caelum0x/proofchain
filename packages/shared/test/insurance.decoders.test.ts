import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiParameter,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeClaimFiled,
  decodePolicyIssued,
  decodePoolCapitalDeposited,
  decodeRiskPoolCovered,
  decodeUnderwritten,
} from "../src/decoders/insurance";

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const POLICY_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000a1" as const;
const BATCH_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
const CLAIM_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000c1" as const;

interface EncodedLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

function asTopics(topics: readonly (Hex | readonly Hex[] | null)[]): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") {
      throw new Error("Test fixture produced a non-scalar topic");
    }
    return t;
  });
}

function data(types: readonly AbiParameter[], values: readonly unknown[]): Hex {
  return encodeAbiParameters(types, values);
}

const policyIssuedAbi = [
  {
    type: "event",
    name: "PolicyIssued",
    anonymous: false,
    inputs: [
      { name: "policyId", type: "bytes32", indexed: true },
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "holder", type: "address", indexed: true },
      { name: "coverage", type: "uint256", indexed: false },
      { name: "premium", type: "uint256", indexed: false },
    ],
  },
] as const;

const claimFiledAbi = [
  {
    type: "event",
    name: "ClaimFiled",
    anonymous: false,
    inputs: [
      { name: "claimId", type: "bytes32", indexed: true },
      { name: "policyId", type: "bytes32", indexed: true },
      { name: "claimant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const depositedAbi = [
  {
    type: "event",
    name: "Deposited",
    anonymous: false,
    inputs: [
      { name: "provider", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const coveredAbi = [
  {
    type: "event",
    name: "Covered",
    anonymous: false,
    inputs: [
      { name: "policyId", type: "bytes32", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const underwrittenAbi = [
  {
    type: "event",
    name: "Underwritten",
    anonymous: false,
    inputs: [
      { name: "policyId", type: "bytes32", indexed: true },
      { name: "coverage", type: "uint256", indexed: false },
    ],
  },
] as const;

function encodePolicyIssued(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: policyIssuedAbi,
        eventName: "PolicyIssued",
        args: { policyId: POLICY_ID, batchId: BATCH_ID, holder: ADDR_A },
      }),
    ),
    data: data([{ type: "uint256" }, { type: "uint256" }], [100_000n, 2_500n]),
  };
}

function encodeClaimFiled(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: claimFiledAbi,
        eventName: "ClaimFiled",
        args: { claimId: CLAIM_ID, policyId: POLICY_ID, claimant: ADDR_B },
      }),
    ),
    data: data([{ type: "uint256" }], [80_000n]),
  };
}

function encodeDeposited(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: depositedAbi,
        eventName: "Deposited",
        args: { provider: ADDR_A, token: ADDR_B },
      }),
    ),
    data: data([{ type: "uint256" }], [500_000n]),
  };
}

function encodeCovered(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: coveredAbi,
        eventName: "Covered",
        args: { policyId: POLICY_ID, to: ADDR_B },
      }),
    ),
    data: data([{ type: "uint256" }], [30_000n]),
  };
}

function encodeUnderwritten(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: underwrittenAbi,
        eventName: "Underwritten",
        args: { policyId: POLICY_ID },
      }),
    ),
    data: data([{ type: "uint256" }], [100_000n]),
  };
}

describe("decodePolicyIssued", () => {
  it("decodes three indexed hashes/addresses plus two amounts", () => {
    const e = decodePolicyIssued(encodePolicyIssued());
    expect(e?.eventName).toBe("PolicyIssued");
    expect(e?.policyId).toBe(POLICY_ID);
    expect(e?.batchId).toBe(BATCH_ID);
    expect(e?.holder).toBe(ADDR_A);
    expect(e?.coverage).toBe(100_000n);
    expect(e?.premium).toBe(2_500n);
  });

  it("returns null for a foreign event", () => {
    expect(decodePolicyIssued(encodeCovered())).toBeNull();
  });

  it("returns an immutable (frozen) payload", () => {
    expect(Object.isFrozen(decodePolicyIssued(encodePolicyIssued()))).toBe(true);
  });
});

describe("decodeClaimFiled", () => {
  it("decodes claim/policy ids, claimant, and amount", () => {
    const e = decodeClaimFiled(encodeClaimFiled());
    expect(e?.eventName).toBe("ClaimFiled");
    expect(e?.claimId).toBe(CLAIM_ID);
    expect(e?.policyId).toBe(POLICY_ID);
    expect(e?.claimant).toBe(ADDR_B);
    expect(e?.amount).toBe(80_000n);
  });
});

describe("decodePoolCapitalDeposited", () => {
  it("decodes provider, token, and amount", () => {
    const e = decodePoolCapitalDeposited(encodeDeposited());
    expect(e?.eventName).toBe("Deposited");
    expect(e?.provider).toBe(ADDR_A);
    expect(e?.token).toBe(ADDR_B);
    expect(e?.amount).toBe(500_000n);
  });
});

describe("decodeRiskPoolCovered", () => {
  it("decodes the covered shortfall", () => {
    const e = decodeRiskPoolCovered(encodeCovered());
    expect(e?.eventName).toBe("Covered");
    expect(e?.policyId).toBe(POLICY_ID);
    expect(e?.to).toBe(ADDR_B);
    expect(e?.amount).toBe(30_000n);
  });
});

describe("decodeUnderwritten", () => {
  it("decodes the reserved coverage", () => {
    const e = decodeUnderwritten(encodeUnderwritten());
    expect(e?.eventName).toBe("Underwritten");
    expect(e?.policyId).toBe(POLICY_ID);
    expect(e?.coverage).toBe(100_000n);
  });
});
