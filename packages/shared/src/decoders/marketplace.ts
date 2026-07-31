/**
 * `marketplace` domain event decoders.
 *
 * viem-log decoders for the key marketplace events: the {ListingRegistry}, the
 * {AuctionHouse} + {BidManager}, the {OrderBook}, and the
 * {FinancingMarketplace}. Each helper decodes a raw log against exactly one
 * contract ABI, asserts the event name, validates the args with zod, and
 * normalizes them into the immutable, branded mirrors from `../types/marketplace`.
 *
 * viem's `decodeEventLog` returns every integer (uint8/64/256) as a `bigint`;
 * these decoders keep amounts/ids/timestamps as `bigint` and narrow the
 * `AssetKind` / `OrderSide` enums through the shared, validated
 * {@link decodeEnum}. Every helper throws {@link ValidationError} on a
 * non-matching or malformed log — no silent coercion. Re-exported by
 * `../decoders/index.ts`.
 */
import { z } from "zod";

import type { ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { decodeEnum } from "../structs";
import { AddressSchema, AssetKind, Bytes32Schema, OrderSide } from "../types";
import type {
  AuctionBidEvent,
  AuctionSettledEvent,
  AuctionStartedEvent,
  BidEscrowedEvent,
  BidRefundedEvent,
  BidSettledEvent,
  ListingCancelledEvent,
  ListingCreatedEvent,
  ListingFilledEvent,
  OfferCancelledEvent,
  OfferMadeEvent,
  OfferTakenEvent,
  OrderCancelledEvent,
  OrderMatchedEvent,
  OrderPlacedEvent,
} from "../types/marketplace";
import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Shared arg coercions + event dispatch
// ---------------------------------------------------------------------------

/** Accepts a `bigint`, safe integer, or decimal string and yields a `bigint`. */
const BigIntLike = z.preprocess((v) => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^\d+$/u.test(v)) return BigInt(v);
  return v;
}, z.bigint().nonnegative("Value must be non-negative"));

/** Accepts a `bigint`, safe integer, or decimal string and yields a `number` (small enums). */
const NumberLike = z.preprocess((v) => {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/u.test(v)) return Number(v);
  return v;
}, z.number().int("Expected an integer").nonnegative("Value must be >= 0"));

/**
 * Decode `log` against `contract`'s ABI and assert it is the `eventName` event,
 * returning its raw args. Throws {@link ValidationError} when the log does not
 * decode against the contract or decodes to a different event.
 */
function eventArgs(
  contract: ContractName,
  eventName: string,
  log: unknown,
): Readonly<Record<string, unknown>> {
  const decoded = decodeContractEvent(contract, log);
  if (decoded === null) {
    throw new ValidationError(`Log does not match any ${contract} event`, {
      contract,
      expected: eventName,
    });
  }
  if (decoded.eventName !== eventName) {
    throw new ValidationError(
      `Expected ${contract}.${eventName} but decoded ${decoded.eventName}`,
      { contract, expected: eventName, actual: decoded.eventName },
    );
  }
  return decoded.args;
}

/** Parse raw args with `schema`, re-wrapping Zod failures as {@link ValidationError}. */
function parseArgs<S extends z.ZodTypeAny>(
  schema: S,
  args: unknown,
  eventName: string,
): z.infer<S> {
  const result = schema.safeParse(args);
  if (!result.success) {
    throw new ValidationError(
      `Invalid ${eventName} event args`,
      result.error.flatten(),
    );
  }
  return result.data;
}

const AssetKindValues = [
  AssetKind.Unknown,
  AssetKind.Receivable,
  AssetKind.ERC721,
  AssetKind.ERC1155,
] as const;

const OrderSideValues = [OrderSide.Buy, OrderSide.Sell] as const;

// ---------------------------------------------------------------------------
// ListingRegistry
// ---------------------------------------------------------------------------

const ListingCreatedSchema = z.object({
  listingId: BigIntLike,
  seller: AddressSchema,
  kind: NumberLike,
  asset: AddressSchema,
  assetId: BigIntLike,
  price: BigIntLike,
});

export function decodeListingCreated(log: unknown): ListingCreatedEvent {
  const a = parseArgs(
    ListingCreatedSchema,
    eventArgs("ListingRegistry", "ListingCreated", log),
    "ListingCreated",
  );
  return Object.freeze({
    listingId: a.listingId,
    seller: a.seller,
    kind: decodeEnum("AssetKind", AssetKindValues, a.kind),
    asset: a.asset,
    assetId: a.assetId,
    price: a.price,
  });
}

const ListingIdOnlySchema = z.object({ listingId: BigIntLike });

export function decodeListingCancelled(log: unknown): ListingCancelledEvent {
  const a = parseArgs(
    ListingIdOnlySchema,
    eventArgs("ListingRegistry", "ListingCancelled", log),
    "ListingCancelled",
  );
  return Object.freeze({ listingId: a.listingId });
}

const ListingFilledSchema = z.object({
  listingId: BigIntLike,
  buyer: AddressSchema,
});

export function decodeListingFilled(log: unknown): ListingFilledEvent {
  const a = parseArgs(
    ListingFilledSchema,
    eventArgs("ListingRegistry", "ListingFilled", log),
    "ListingFilled",
  );
  return Object.freeze({ listingId: a.listingId, buyer: a.buyer });
}

// ---------------------------------------------------------------------------
// AuctionHouse
// ---------------------------------------------------------------------------

const AuctionStartedSchema = z.object({
  auctionId: BigIntLike,
  nft: AddressSchema,
  tokenId: BigIntLike,
  seller: AddressSchema,
  endTime: BigIntLike,
});

export function decodeAuctionStarted(log: unknown): AuctionStartedEvent {
  const a = parseArgs(
    AuctionStartedSchema,
    eventArgs("AuctionHouse", "AuctionStarted", log),
    "AuctionStarted",
  );
  return Object.freeze({
    auctionId: a.auctionId,
    nft: a.nft,
    tokenId: a.tokenId,
    seller: a.seller,
    endTime: a.endTime,
  });
}

const AuctionBidSchema = z.object({
  auctionId: BigIntLike,
  bidder: AddressSchema,
  amount: BigIntLike,
});

export function decodeAuctionBid(log: unknown): AuctionBidEvent {
  const a = parseArgs(
    AuctionBidSchema,
    eventArgs("AuctionHouse", "Bid", log),
    "Bid",
  );
  return Object.freeze({
    auctionId: a.auctionId,
    bidder: a.bidder,
    amount: a.amount,
  });
}

const AuctionSettledSchema = z.object({
  auctionId: BigIntLike,
  winner: AddressSchema,
  amount: BigIntLike,
});

export function decodeAuctionSettled(log: unknown): AuctionSettledEvent {
  const a = parseArgs(
    AuctionSettledSchema,
    eventArgs("AuctionHouse", "Settled", log),
    "Settled",
  );
  return Object.freeze({
    auctionId: a.auctionId,
    winner: a.winner,
    amount: a.amount,
  });
}

// ---------------------------------------------------------------------------
// OrderBook
// ---------------------------------------------------------------------------

const OrderPlacedSchema = z.object({
  orderId: BigIntLike,
  side: NumberLike,
  maker: AddressSchema,
  asset: AddressSchema,
  price: BigIntLike,
  quantity: BigIntLike,
});

export function decodeOrderPlaced(log: unknown): OrderPlacedEvent {
  const a = parseArgs(
    OrderPlacedSchema,
    eventArgs("OrderBook", "OrderPlaced", log),
    "OrderPlaced",
  );
  return Object.freeze({
    orderId: a.orderId,
    side: decodeEnum("OrderSide", OrderSideValues, a.side),
    maker: a.maker,
    asset: a.asset,
    price: a.price,
    quantity: a.quantity,
  });
}

const OrderMatchedSchema = z.object({
  buyOrderId: BigIntLike,
  sellOrderId: BigIntLike,
  quantity: BigIntLike,
  price: BigIntLike,
});

export function decodeOrderMatched(log: unknown): OrderMatchedEvent {
  const a = parseArgs(
    OrderMatchedSchema,
    eventArgs("OrderBook", "OrderMatched", log),
    "OrderMatched",
  );
  return Object.freeze({
    buyOrderId: a.buyOrderId,
    sellOrderId: a.sellOrderId,
    quantity: a.quantity,
    price: a.price,
  });
}

const OrderIdOnlySchema = z.object({ orderId: BigIntLike });

export function decodeOrderCancelled(log: unknown): OrderCancelledEvent {
  const a = parseArgs(
    OrderIdOnlySchema,
    eventArgs("OrderBook", "OrderCancelled", log),
    "OrderCancelled",
  );
  return Object.freeze({ orderId: a.orderId });
}

// ---------------------------------------------------------------------------
// BidManager
// ---------------------------------------------------------------------------

const BidEscrowedSchema = z.object({
  auctionId: BigIntLike,
  bidder: AddressSchema,
  token: AddressSchema,
  amount: BigIntLike,
});

export function decodeBidEscrowed(log: unknown): BidEscrowedEvent {
  const a = parseArgs(
    BidEscrowedSchema,
    eventArgs("BidManager", "BidEscrowed", log),
    "BidEscrowed",
  );
  return Object.freeze({
    auctionId: a.auctionId,
    bidder: a.bidder,
    token: a.token,
    amount: a.amount,
  });
}

const BidRefundedSchema = z.object({
  auctionId: BigIntLike,
  bidder: AddressSchema,
  amount: BigIntLike,
});

export function decodeBidRefunded(log: unknown): BidRefundedEvent {
  const a = parseArgs(
    BidRefundedSchema,
    eventArgs("BidManager", "BidRefunded", log),
    "BidRefunded",
  );
  return Object.freeze({
    auctionId: a.auctionId,
    bidder: a.bidder,
    amount: a.amount,
  });
}

const BidSettledSchema = z.object({
  auctionId: BigIntLike,
  bidder: AddressSchema,
  to: AddressSchema,
  amount: BigIntLike,
});

export function decodeBidSettled(log: unknown): BidSettledEvent {
  const a = parseArgs(
    BidSettledSchema,
    eventArgs("BidManager", "BidSettled", log),
    "BidSettled",
  );
  return Object.freeze({
    auctionId: a.auctionId,
    bidder: a.bidder,
    to: a.to,
    amount: a.amount,
  });
}

// ---------------------------------------------------------------------------
// FinancingMarketplace
// ---------------------------------------------------------------------------

const OfferMadeSchema = z.object({
  offerId: BigIntLike,
  batchId: Bytes32Schema,
  maker: AddressSchema,
  amount: BigIntLike,
});

export function decodeOfferMade(log: unknown): OfferMadeEvent {
  const a = parseArgs(
    OfferMadeSchema,
    eventArgs("FinancingMarketplace", "OfferMade", log),
    "OfferMade",
  );
  return Object.freeze({
    offerId: a.offerId,
    batchId: a.batchId as `0x${string}`,
    maker: a.maker,
    amount: a.amount,
  });
}

const OfferTakenSchema = z.object({
  offerId: BigIntLike,
  taker: AddressSchema,
});

export function decodeOfferTaken(log: unknown): OfferTakenEvent {
  const a = parseArgs(
    OfferTakenSchema,
    eventArgs("FinancingMarketplace", "OfferTaken", log),
    "OfferTaken",
  );
  return Object.freeze({ offerId: a.offerId, taker: a.taker });
}

const OfferIdOnlySchema = z.object({ offerId: BigIntLike });

export function decodeOfferCancelled(log: unknown): OfferCancelledEvent {
  const a = parseArgs(
    OfferIdOnlySchema,
    eventArgs("FinancingMarketplace", "OfferCancelled", log),
    "OfferCancelled",
  );
  return Object.freeze({ offerId: a.offerId });
}
