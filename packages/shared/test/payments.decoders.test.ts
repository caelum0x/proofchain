import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiParameter,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeEscrowFunded,
  decodeFeeBpsSet,
  decodeFullySettled,
  decodePaymentRouted,
  decodeTokenAdded,
} from "../src/decoders/payments";

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const ADDR_C = "0x3333333333333333333333333333333333333333" as const;
const BATCH_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
const ACTION =
  "0x00000000000000000000000000000000000000000000000000000000000000cd" as const;

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

const fundedAbi = [
  {
    type: "event",
    name: "Funded",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "supplier", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const fullySettledAbi = [
  {
    type: "event",
    name: "FullySettled",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "released", type: "bool", indexed: false },
      { name: "score", type: "uint16", indexed: false },
    ],
  },
] as const;

const routedAbi = [
  {
    type: "event",
    name: "Routed",
    anonymous: false,
    inputs: [
      { name: "action", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "destination", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
] as const;

const feeBpsSetAbi = [
  {
    type: "event",
    name: "FeeBpsSet",
    anonymous: false,
    inputs: [
      { name: "action", type: "bytes32", indexed: true },
      { name: "bps", type: "uint16", indexed: false },
    ],
  },
] as const;

const tokenAddedAbi = [
  {
    type: "event",
    name: "TokenAdded",
    anonymous: false,
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "decimals", type: "uint8", indexed: false },
    ],
  },
] as const;

function encodeFunded(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: fundedAbi,
        eventName: "Funded",
        args: { batchId: BATCH_ID, buyer: ADDR_A },
      }),
    ),
    data: data(
      [{ type: "address" }, { type: "address" }, { type: "uint256" }],
      [ADDR_B, ADDR_C, 1_000_000n],
    ),
  };
}

function encodeFullySettled(released: boolean, score: number): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: fullySettledAbi,
        eventName: "FullySettled",
        args: { batchId: BATCH_ID },
      }),
    ),
    data: data([{ type: "bool" }, { type: "uint16" }], [released, score]),
  };
}

function encodeRouted(): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: routedAbi,
        eventName: "Routed",
        args: { action: ACTION, token: ADDR_A, payer: ADDR_B },
      }),
    ),
    data: data(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      [ADDR_C, 990n, 10n],
    ),
  };
}

function encodeFeeBpsSet(bps: number): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: feeBpsSetAbi,
        eventName: "FeeBpsSet",
        args: { action: ACTION },
      }),
    ),
    data: data([{ type: "uint16" }], [bps]),
  };
}

function encodeTokenAdded(decimals: number): EncodedLog {
  return {
    topics: asTopics(
      encodeEventTopics({
        abi: tokenAddedAbi,
        eventName: "TokenAdded",
        args: { token: ADDR_A },
      }),
    ),
    data: data([{ type: "uint8" }], [decimals]),
  };
}

describe("decodeEscrowFunded", () => {
  it("decodes indexed + non-indexed args", () => {
    const e = decodeEscrowFunded(encodeFunded());
    expect(e?.eventName).toBe("Funded");
    expect(e?.batchId).toBe(BATCH_ID);
    expect(e?.buyer).toBe(ADDR_A);
    expect(e?.supplier).toBe(ADDR_B);
    expect(e?.token).toBe(ADDR_C);
    expect(e?.amount).toBe(1_000_000n);
  });

  it("returns null for a foreign event", () => {
    expect(decodeEscrowFunded(encodeTokenAdded(6))).toBeNull();
  });
});

describe("decodeFullySettled", () => {
  it("decodes a bool + uint16 payload", () => {
    const e = decodeFullySettled(encodeFullySettled(true, 9600));
    expect(e?.eventName).toBe("FullySettled");
    expect(e?.released).toBe(true);
    expect(e?.score).toBe(9600);
    expect(typeof e?.score).toBe("number");
  });
});

describe("decodePaymentRouted", () => {
  it("decodes three indexed topics plus the data words", () => {
    const e = decodePaymentRouted(encodeRouted());
    expect(e?.eventName).toBe("Routed");
    expect(e?.action).toBe(ACTION);
    expect(e?.token).toBe(ADDR_A);
    expect(e?.payer).toBe(ADDR_B);
    expect(e?.destination).toBe(ADDR_C);
    expect(e?.amount).toBe(990n);
    expect(e?.fee).toBe(10n);
  });
});

describe("decodeFeeBpsSet", () => {
  it("decodes the action key and bps", () => {
    const e = decodeFeeBpsSet(encodeFeeBpsSet(25));
    expect(e?.eventName).toBe("FeeBpsSet");
    expect(e?.action).toBe(ACTION);
    expect(e?.bps).toBe(25);
  });
});

describe("decodeTokenAdded", () => {
  it("decodes token and decimals", () => {
    const e = decodeTokenAdded(encodeTokenAdded(6));
    expect(e?.eventName).toBe("TokenAdded");
    expect(e?.token).toBe(ADDR_A);
    expect(e?.decimals).toBe(6);
    expect(Object.isFrozen(e)).toBe(true);
  });
});
