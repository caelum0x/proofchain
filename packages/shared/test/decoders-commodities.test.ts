import {
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeGraded,
  decodeHarvestRegistered,
  decodePriceUpdated,
  decodeVaultDeposited,
  decodeVaultRedeemed,
} from "../src/decoders/commodities";

const hex32 = (b: string): Hex => `0x${b.repeat(32)}` as Hex;
const PRODUCER = "0x3333333333333333333333333333333333333333" as const;
const HOLDER = "0x4444444444444444444444444444444444444444" as const;
const GRADER = "0x5555555555555555555555555555555555555555" as const;
const HARVEST = hex32("b1");
const CROP = hex32("b2");
const SEASON = hex32("b3");
const RECEIPT = hex32("b4");
const CODE = hex32("b5");
const GRADING = hex32("b6");
const LOT = hex32("b7");
const STANDARD = hex32("b8");
const GRADE = hex32("b9");
const SYMBOL = hex32("ba");

const asScalar = (t: Hex | readonly Hex[] | null): Hex => {
  if (typeof t !== "string") throw new Error("non-scalar topic in fixture");
  return t;
};

const harvestAbi = [
  {
    type: "event",
    name: "HarvestRegistered",
    anonymous: false,
    inputs: [
      { name: "harvestId", type: "bytes32", indexed: true },
      { name: "producer", type: "address", indexed: true },
      { name: "crop", type: "bytes32", indexed: true },
      { name: "quantityKg", type: "uint256", indexed: false },
      { name: "season", type: "bytes32", indexed: false },
    ],
  },
] as const;

const gradedAbi = [
  {
    type: "event",
    name: "Graded",
    anonymous: false,
    inputs: [
      { name: "gradingId", type: "bytes32", indexed: true },
      { name: "lotId", type: "bytes32", indexed: true },
      { name: "standard", type: "bytes32", indexed: true },
      { name: "grade", type: "bytes32", indexed: false },
      { name: "score", type: "uint16", indexed: false },
      { name: "grader", type: "address", indexed: false },
    ],
  },
] as const;

const priceAbi = [
  {
    type: "event",
    name: "PriceUpdated",
    anonymous: false,
    inputs: [
      { name: "symbol", type: "bytes32", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "updatedAt", type: "uint64", indexed: false },
    ],
  },
] as const;

const depositedAbi = [
  {
    type: "event",
    name: "Deposited",
    anonymous: false,
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "holder", type: "address", indexed: true },
      { name: "commodityCode", type: "bytes32", indexed: true },
      { name: "tokenAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

function encodeHarvest(quantityKg: bigint) {
  const topics = encodeEventTopics({
    abi: harvestAbi,
    eventName: "HarvestRegistered",
    args: { harvestId: HARVEST, producer: PRODUCER, crop: CROP },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes32" }],
    [quantityKg, SEASON],
  );
  return { topics, data };
}

function encodeGraded(score: number) {
  const topics = encodeEventTopics({
    abi: gradedAbi,
    eventName: "Graded",
    args: { gradingId: GRADING, lotId: LOT, standard: STANDARD },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "uint16" }, { type: "address" }],
    [GRADE, score, GRADER],
  );
  return { topics, data };
}

function encodePrice(price: bigint, updatedAt: bigint) {
  const topics = encodeEventTopics({
    abi: priceAbi,
    eventName: "PriceUpdated",
    args: { symbol: SYMBOL },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint64" }],
    [price, updatedAt],
  );
  return { topics, data };
}

function encodeDeposited(tokenAmount: bigint) {
  const topics = encodeEventTopics({
    abi: depositedAbi,
    eventName: "Deposited",
    args: { receiptId: RECEIPT, holder: HOLDER, commodityCode: CODE },
  }).map(asScalar);
  const data = encodeAbiParameters([{ type: "uint256" }], [tokenAmount]);
  return { topics, data };
}

describe("decodeHarvestRegistered", () => {
  it("decodes three indexed fields plus a uint256 quantity", () => {
    const decoded = decodeHarvestRegistered(encodeHarvest(12_500n));
    expect(decoded?.harvestId).toBe(HARVEST);
    expect(decoded?.producer).toBe(PRODUCER);
    expect(decoded?.crop).toBe(CROP);
    expect(decoded?.quantityKg).toBe(12_500n);
    expect(decoded?.season).toBe(SEASON);
  });
});

describe("decodeGraded", () => {
  it("decodes the bps score and grader address", () => {
    const decoded = decodeGraded(encodeGraded(9100));
    expect(decoded?.gradingId).toBe(GRADING);
    expect(decoded?.lotId).toBe(LOT);
    expect(decoded?.standard).toBe(STANDARD);
    expect(decoded?.grade).toBe(GRADE);
    expect(decoded?.score).toBe(9100);
    expect(decoded?.grader).toBe(GRADER);
  });
});

describe("decodePriceUpdated", () => {
  it("decodes uint256 price and uint64 timestamp", () => {
    const decoded = decodePriceUpdated(encodePrice(4_200_000n, 1_700_000_500n));
    expect(decoded?.symbol).toBe(SYMBOL);
    expect(decoded?.price).toBe(4_200_000n);
    expect(decoded?.updatedAt).toBe(1_700_000_500n);
  });
});

describe("decodeVaultDeposited", () => {
  it("decodes the Deposited event on the vault contract", () => {
    const decoded = decodeVaultDeposited(encodeDeposited(1_000n));
    expect(decoded?.receiptId).toBe(RECEIPT);
    expect(decoded?.holder).toBe(HOLDER);
    expect(decoded?.commodityCode).toBe(CODE);
    expect(decoded?.tokenAmount).toBe(1_000n);
  });

  it("returns null when decoding a Deposited log as Redeemed", () => {
    expect(decodeVaultRedeemed(encodeDeposited(1_000n))).toBeNull();
  });
});
