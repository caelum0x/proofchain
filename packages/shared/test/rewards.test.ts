import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiEvent,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeConversionRecorded,
  decodeEmissionRateSet,
  decodeLoyaltyTransferabilityUpdated,
  decodeRewardClaimed,
  decodeRewardRootSet,
} from "../src/decoders/rewards";
import { ValidationError } from "../src/errors";

// --- encoding utilities ------------------------------------------------------

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ROOT =
  "0x00000000000000000000000000000000000000000000000000000000000000cc" as const;

interface EncodedLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

function scalarTopics(
  topics: readonly (Hex | readonly Hex[] | null)[],
): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") {
      throw new Error("Test fixture produced a non-scalar topic");
    }
    return t;
  });
}

function topics(
  abi: readonly AbiEvent[],
  eventName: string,
  args: Record<string, unknown>,
): Hex[] {
  return scalarTopics(encodeEventTopics({ abi, eventName, args } as never));
}

const rootSetAbi = [
  {
    type: "event",
    name: "RootSet",
    anonymous: false,
    inputs: [
      { name: "root", type: "bytes32", indexed: true },
      { name: "epoch", type: "uint256", indexed: true },
    ],
  },
] as const;

const claimedAbi = [
  {
    type: "event",
    name: "Claimed",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "epoch", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const conversionRecordedAbi = [
  {
    type: "event",
    name: "ConversionRecorded",
    anonymous: false,
    inputs: [
      { name: "referee", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
      { name: "reward", type: "uint256", indexed: false },
    ],
  },
] as const;

const transferabilityAbi = [
  {
    type: "event",
    name: "TransferabilityUpdated",
    anonymous: false,
    inputs: [{ name: "transferable", type: "bool", indexed: false }],
  },
] as const;

const emissionRateSetAbi = [
  {
    type: "event",
    name: "EmissionRateSet",
    anonymous: false,
    inputs: [
      { name: "epoch", type: "uint256", indexed: true },
      { name: "rate", type: "uint256", indexed: false },
    ],
  },
] as const;

// --- tests -------------------------------------------------------------------

describe("decodeRewardRootSet", () => {
  it("decodes the fully-indexed root + epoch (empty data)", () => {
    const log: EncodedLog = {
      topics: topics(rootSetAbi as never, "RootSet", {
        root: ROOT,
        epoch: 3n,
      }),
      data: "0x",
    };
    const ev = decodeRewardRootSet(log);
    expect(ev.root).toBe(ROOT);
    expect(ev.epoch).toBe(3n);
  });
});

describe("decodeRewardClaimed", () => {
  it("decodes the account, epoch, and amount", () => {
    const log: EncodedLog = {
      topics: topics(claimedAbi as never, "Claimed", {
        account: ADDR_A,
        epoch: 3n,
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [42_000n]),
    };
    const ev = decodeRewardClaimed(log);
    expect(ev.account).toBe(ADDR_A);
    expect(ev.epoch).toBe(3n);
    expect(ev.amount).toBe(42_000n);
  });

  it("throws ValidationError when the log is a different event", () => {
    const log: EncodedLog = {
      topics: topics(rootSetAbi as never, "RootSet", { root: ROOT, epoch: 1n }),
      data: "0x",
    };
    expect(() => decodeRewardClaimed(log)).toThrow(ValidationError);
  });
});

describe("decodeConversionRecorded", () => {
  it("decodes both the conversion value and the accrued reward", () => {
    const log: EncodedLog = {
      topics: topics(conversionRecordedAbi as never, "ConversionRecorded", {
        referee: ADDR_A,
      }),
      data: encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }],
        [1_000_000n, 25_000n],
      ),
    };
    const ev = decodeConversionRecorded(log);
    expect(ev.referee).toBe(ADDR_A);
    expect(ev.value).toBe(1_000_000n);
    expect(ev.reward).toBe(25_000n);
  });
});

describe("decodeLoyaltyTransferabilityUpdated", () => {
  it("decodes the transferability flag", () => {
    const log: EncodedLog = {
      topics: topics(
        transferabilityAbi as never,
        "TransferabilityUpdated",
        {},
      ),
      data: encodeAbiParameters([{ type: "bool" }], [true]),
    };
    const ev = decodeLoyaltyTransferabilityUpdated(log);
    expect(ev.transferable).toBe(true);
  });
});

describe("decodeEmissionRateSet", () => {
  it("decodes the epoch + per-second rate", () => {
    const log: EncodedLog = {
      topics: topics(emissionRateSetAbi as never, "EmissionRateSet", {
        epoch: 2n,
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [1_000n]),
    };
    const ev = decodeEmissionRateSet(log);
    expect(ev.epoch).toBe(2n);
    expect(ev.rate).toBe(1_000n);
  });

  it("throws ValidationError on structurally invalid input", () => {
    expect(() =>
      decodeEmissionRateSet({ topics: [], data: "not-hex" }),
    ).toThrow(ValidationError);
  });
});
