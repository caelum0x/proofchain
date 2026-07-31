import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiEvent,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeAuctionStarted,
  decodeBidSettled,
  decodeListingCreated,
  decodeOfferMade,
  decodeOrderMatched,
  decodeOrderPlaced,
} from "../src/decoders/marketplace";
import { ValidationError } from "../src/errors";
import { AssetKind, OrderSide } from "../src/types";

// --- encoding utilities ------------------------------------------------------

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const ADDR_TOKEN = "0x4444444444444444444444444444444444444444" as const;
const BATCH_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;

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

const listingCreatedAbi = [
  {
    type: "event",
    name: "ListingCreated",
    anonymous: false,
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "kind", type: "uint8", indexed: false },
      { name: "asset", type: "address", indexed: false },
      { name: "assetId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
] as const;

const orderPlacedAbi = [
  {
    type: "event",
    name: "OrderPlaced",
    anonymous: false,
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "maker", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "quantity", type: "uint256", indexed: false },
    ],
  },
] as const;

const orderMatchedAbi = [
  {
    type: "event",
    name: "OrderMatched",
    anonymous: false,
    inputs: [
      { name: "buyOrderId", type: "uint256", indexed: true },
      { name: "sellOrderId", type: "uint256", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
] as const;

const auctionStartedAbi = [
  {
    type: "event",
    name: "AuctionStarted",
    anonymous: false,
    inputs: [
      { name: "auctionId", type: "uint256", indexed: true },
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: false },
      { name: "endTime", type: "uint64", indexed: false },
    ],
  },
] as const;

const bidSettledAbi = [
  {
    type: "event",
    name: "BidSettled",
    anonymous: false,
    inputs: [
      { name: "auctionId", type: "uint256", indexed: true },
      { name: "bidder", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const offerMadeAbi = [
  {
    type: "event",
    name: "OfferMade",
    anonymous: false,
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// --- tests -------------------------------------------------------------------

describe("decodeListingCreated", () => {
  it("narrows the uint8 kind into the AssetKind enum", () => {
    const log: EncodedLog = {
      topics: topics(listingCreatedAbi as never, "ListingCreated", {
        listingId: 1n,
        seller: ADDR_A,
      }),
      data: encodeAbiParameters(
        [
          { type: "uint8" },
          { type: "address" },
          { type: "uint256" },
          { type: "uint256" },
        ],
        [2, ADDR_B, 99n, 1_000_000n],
      ),
    };
    const ev = decodeListingCreated(log);
    expect(ev.listingId).toBe(1n);
    expect(ev.seller).toBe(ADDR_A);
    expect(ev.kind).toBe(AssetKind.ERC721);
    expect(ev.asset).toBe(ADDR_B);
    expect(ev.assetId).toBe(99n);
    expect(ev.price).toBe(1_000_000n);
  });

  it("rejects an out-of-range AssetKind value", () => {
    const log: EncodedLog = {
      topics: topics(listingCreatedAbi as never, "ListingCreated", {
        listingId: 1n,
        seller: ADDR_A,
      }),
      data: encodeAbiParameters(
        [
          { type: "uint8" },
          { type: "address" },
          { type: "uint256" },
          { type: "uint256" },
        ],
        [8, ADDR_B, 0n, 1n],
      ),
    };
    expect(() => decodeListingCreated(log)).toThrow(ValidationError);
  });

  it("throws ValidationError when the log is a different event", () => {
    const log: EncodedLog = {
      topics: topics(orderMatchedAbi as never, "OrderMatched", {
        buyOrderId: 1n,
        sellOrderId: 2n,
      }),
      data: encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }],
        [1n, 1n],
      ),
    };
    expect(() => decodeListingCreated(log)).toThrow(ValidationError);
  });
});

describe("decodeOrderPlaced", () => {
  it("narrows the uint8 side into the OrderSide enum", () => {
    const log: EncodedLog = {
      topics: topics(orderPlacedAbi as never, "OrderPlaced", {
        orderId: 3n,
        maker: ADDR_A,
      }),
      data: encodeAbiParameters(
        [
          { type: "uint8" },
          { type: "address" },
          { type: "uint256" },
          { type: "uint256" },
        ],
        [1, ADDR_B, 10n, 5n],
      ),
    };
    const ev = decodeOrderPlaced(log);
    expect(ev.orderId).toBe(3n);
    expect(ev.side).toBe(OrderSide.Sell);
    expect(ev.maker).toBe(ADDR_A);
    expect(ev.asset).toBe(ADDR_B);
    expect(ev.price).toBe(10n);
    expect(ev.quantity).toBe(5n);
  });
});

describe("decodeOrderMatched", () => {
  it("decodes both indexed order ids and the fill", () => {
    const log: EncodedLog = {
      topics: topics(orderMatchedAbi as never, "OrderMatched", {
        buyOrderId: 4n,
        sellOrderId: 5n,
      }),
      data: encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }],
        [3n, 100n],
      ),
    };
    const ev = decodeOrderMatched(log);
    expect(ev.buyOrderId).toBe(4n);
    expect(ev.sellOrderId).toBe(5n);
    expect(ev.quantity).toBe(3n);
    expect(ev.price).toBe(100n);
  });
});

describe("decodeAuctionStarted", () => {
  it("decodes the uint64 endTime as a bigint", () => {
    const endTime = 1_800_000_000n;
    const log: EncodedLog = {
      topics: topics(auctionStartedAbi as never, "AuctionStarted", {
        auctionId: 6n,
        nft: ADDR_B,
        tokenId: 77n,
      }),
      data: encodeAbiParameters(
        [{ type: "address" }, { type: "uint64" }],
        [ADDR_A, endTime],
      ),
    };
    const ev = decodeAuctionStarted(log);
    expect(ev.auctionId).toBe(6n);
    expect(ev.nft).toBe(ADDR_B);
    expect(ev.tokenId).toBe(77n);
    expect(ev.seller).toBe(ADDR_A);
    expect(ev.endTime).toBe(endTime);
  });
});

describe("decodeBidSettled", () => {
  it("decodes the three indexed addresses + amount", () => {
    const log: EncodedLog = {
      topics: topics(bidSettledAbi as never, "BidSettled", {
        auctionId: 6n,
        bidder: ADDR_A,
        to: ADDR_B,
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [9_000n]),
    };
    const ev = decodeBidSettled(log);
    expect(ev.auctionId).toBe(6n);
    expect(ev.bidder).toBe(ADDR_A);
    expect(ev.to).toBe(ADDR_B);
    expect(ev.amount).toBe(9_000n);
  });
});

describe("decodeOfferMade", () => {
  it("decodes the indexed batchId + escrowed amount", () => {
    const log: EncodedLog = {
      topics: topics(offerMadeAbi as never, "OfferMade", {
        offerId: 8n,
        batchId: BATCH_ID,
        maker: ADDR_TOKEN,
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [250_000n]),
    };
    const ev = decodeOfferMade(log);
    expect(ev.offerId).toBe(8n);
    expect(ev.batchId).toBe(BATCH_ID);
    expect(ev.maker).toBe(ADDR_TOKEN);
    expect(ev.amount).toBe(250_000n);
  });
});
