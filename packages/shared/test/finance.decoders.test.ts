import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiParameter,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeInvoiceClaimed,
  decodeInvoiceListed,
  decodeMaxGradeUpdated,
  decodePoolDeposited,
  decodeReceivableRegistered,
} from "../src/decoders/finance";

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const BATCH_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;

interface EncodedLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

function asTopics(
  topics: readonly (Hex | readonly Hex[] | null)[],
): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") {
      throw new Error("Test fixture produced a non-scalar topic");
    }
    return t;
  });
}

const receivableRegisteredAbi = [
  {
    type: "event",
    name: "ReceivableRegistered",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "faceValue", type: "uint256", indexed: false },
      { name: "dueDate", type: "uint64", indexed: false },
      { name: "obligor", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
    ],
  },
] as const;

const listedAbi = [
  {
    type: "event",
    name: "Listed",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "supplier", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "askAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

const claimedAbi = [
  {
    type: "event",
    name: "Claimed",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "lender", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "remainderToSupplier", type: "uint256", indexed: false },
    ],
  },
] as const;

const depositedAbi = [
  {
    type: "event",
    name: "Deposited",
    anonymous: false,
    inputs: [
      { name: "lender", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
] as const;

const maxGradeUpdatedAbi = [
  {
    type: "event",
    name: "MaxGradeUpdated",
    anonymous: false,
    inputs: [{ name: "maxGrade", type: "uint8", indexed: false }],
  },
] as const;

function data(types: readonly AbiParameter[], values: readonly unknown[]): Hex {
  return encodeAbiParameters(types, values);
}

function encodeReceivableRegistered(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: receivableRegisteredAbi,
        eventName: "ReceivableRegistered",
        args: { batchId: BATCH_ID, obligor: ADDR_A },
      }),
    ),
    data: data(
      [{ type: "uint256" }, { type: "uint64" }, { type: "address" }],
      [1000n, 1893456000n, ADDR_B],
    ),
  };
}

function encodeListed(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: listedAbi,
        eventName: "Listed",
        args: { batchId: BATCH_ID, supplier: ADDR_A },
      }),
    ),
    data: data([{ type: "address" }, { type: "uint256" }], [ADDR_B, 950n]),
  };
}

function encodeClaimed(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: claimedAbi,
        eventName: "Claimed",
        args: { batchId: BATCH_ID, lender: ADDR_B },
      }),
    ),
    data: data([{ type: "uint256" }, { type: "uint256" }], [900n, 50n]),
  };
}

function encodeDeposited(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: depositedAbi,
        eventName: "Deposited",
        args: { lender: ADDR_A },
      }),
    ),
    data: data([{ type: "uint256" }, { type: "uint256" }], [5000n, 4998n]),
  };
}

function encodeMaxGradeUpdated(grade: number): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({ abi: maxGradeUpdatedAbi, eventName: "MaxGradeUpdated" }),
    ),
    data: data([{ type: "uint8" }], [grade]),
  };
}

describe("decodeReceivableRegistered", () => {
  it("decodes all fields with correct primitive types", () => {
    const e = decodeReceivableRegistered(encodeReceivableRegistered());
    expect(e).not.toBeNull();
    expect(e?.eventName).toBe("ReceivableRegistered");
    expect(e?.batchId).toBe(BATCH_ID);
    expect(e?.faceValue).toBe(1000n);
    expect(e?.dueDate).toBe(1893456000n);
    expect(e?.obligor).toBe(ADDR_A);
    expect(e?.token).toBe(ADDR_B);
  });

  it("returns null for a different event of the same domain", () => {
    expect(decodeReceivableRegistered(encodeListed())).toBeNull();
  });

  it("returns an immutable (frozen) payload", () => {
    const e = decodeReceivableRegistered(encodeReceivableRegistered());
    expect(Object.isFrozen(e)).toBe(true);
  });
});

describe("decodeInvoiceListed", () => {
  it("decodes indexed + non-indexed args", () => {
    const e = decodeInvoiceListed(encodeListed());
    expect(e?.eventName).toBe("Listed");
    expect(e?.batchId).toBe(BATCH_ID);
    expect(e?.supplier).toBe(ADDR_A);
    expect(e?.token).toBe(ADDR_B);
    expect(e?.askAmount).toBe(950n);
  });
});

describe("decodeInvoiceClaimed", () => {
  it("decodes principal and remainder", () => {
    const e = decodeInvoiceClaimed(encodeClaimed());
    expect(e?.eventName).toBe("Claimed");
    expect(e?.lender).toBe(ADDR_B);
    expect(e?.principal).toBe(900n);
    expect(e?.remainderToSupplier).toBe(50n);
  });
});

describe("decodePoolDeposited", () => {
  it("decodes assets and shares", () => {
    const e = decodePoolDeposited(encodeDeposited());
    expect(e?.eventName).toBe("Deposited");
    expect(e?.lender).toBe(ADDR_A);
    expect(e?.assets).toBe(5000n);
    expect(e?.shares).toBe(4998n);
  });
});

describe("decodeMaxGradeUpdated", () => {
  it("decodes a uint8 grade as a number", () => {
    const e = decodeMaxGradeUpdated(encodeMaxGradeUpdated(5));
    expect(e?.eventName).toBe("MaxGradeUpdated");
    expect(e?.maxGrade).toBe(5);
    expect(typeof e?.maxGrade).toBe("number");
  });

  it("returns null when handed an unrelated log", () => {
    expect(decodeMaxGradeUpdated(encodeClaimed())).toBeNull();
  });
});
