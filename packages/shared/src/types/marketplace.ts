/**
 * `marketplace` domain types.
 *
 * Mirrors the on-chain trading venues — the generic {ListingRegistry}, the
 * English {AuctionHouse} + its {BidManager} escrow, the fungible {OrderBook},
 * and the receivable-financing {FinancingMarketplace} — plus the
 * request/response DTOs the api/web layers exchange for these flows.
 *
 * The primary struct mirrors and status enums that are read straight off-chain
 * ({@link MarketListing}, {@link MarketListingStatus}, {@link AssetKind},
 * {@link Auction}, {@link AuctionState}, {@link Order}, {@link OrderSide},
 * {@link FinancingOffer}) live in `./core`; this module adds the event payloads
 * and boundary DTOs. Every field is `readonly`; `bigint` is used for
 * uint256/uint64, `number` for the small bounded enums, and the branded
 * `Address` / `Bytes32` types from `./core`.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";
import type {
  AssetKind,
  Auction,
  MarketListing,
  Order,
  OrderSide,
} from "./core";

// ---------------------------------------------------------------------------
// ListingRegistry event payloads
// ---------------------------------------------------------------------------

/** Decoded `ListingRegistry.ListingCreated`. */
export interface ListingCreatedEvent {
  readonly listingId: bigint;
  readonly seller: Address;
  readonly kind: AssetKind;
  readonly asset: Address;
  readonly assetId: bigint;
  readonly price: bigint;
}

/** Decoded `ListingRegistry.ListingCancelled`. */
export interface ListingCancelledEvent {
  readonly listingId: bigint;
}

/** Decoded `ListingRegistry.ListingFilled`. */
export interface ListingFilledEvent {
  readonly listingId: bigint;
  readonly buyer: Address;
}

// ---------------------------------------------------------------------------
// AuctionHouse event payloads
// ---------------------------------------------------------------------------

/** Decoded `AuctionHouse.AuctionStarted`. */
export interface AuctionStartedEvent {
  readonly auctionId: bigint;
  readonly nft: Address;
  readonly tokenId: bigint;
  readonly seller: Address;
  readonly endTime: bigint;
}

/** Decoded `AuctionHouse.Bid`. */
export interface AuctionBidEvent {
  readonly auctionId: bigint;
  readonly bidder: Address;
  readonly amount: bigint;
}

/** Decoded `AuctionHouse.Settled`. `winner` is the zero address when no bid cleared the reserve. */
export interface AuctionSettledEvent {
  readonly auctionId: bigint;
  readonly winner: Address;
  readonly amount: bigint;
}

// ---------------------------------------------------------------------------
// OrderBook event payloads
// ---------------------------------------------------------------------------

/** Decoded `OrderBook.OrderPlaced`. */
export interface OrderPlacedEvent {
  readonly orderId: bigint;
  readonly side: OrderSide;
  readonly maker: Address;
  readonly asset: Address;
  readonly price: bigint;
  readonly quantity: bigint;
}

/** Decoded `OrderBook.OrderMatched`. Fills execute at the resting ask `price`. */
export interface OrderMatchedEvent {
  readonly buyOrderId: bigint;
  readonly sellOrderId: bigint;
  readonly quantity: bigint;
  readonly price: bigint;
}

/** Decoded `OrderBook.OrderCancelled`. */
export interface OrderCancelledEvent {
  readonly orderId: bigint;
}

// ---------------------------------------------------------------------------
// BidManager event payloads
// ---------------------------------------------------------------------------

/** Decoded `BidManager.BidEscrowed`. */
export interface BidEscrowedEvent {
  readonly auctionId: bigint;
  readonly bidder: Address;
  readonly token: Address;
  readonly amount: bigint;
}

/** Decoded `BidManager.BidRefunded`. */
export interface BidRefundedEvent {
  readonly auctionId: bigint;
  readonly bidder: Address;
  readonly amount: bigint;
}

/** Decoded `BidManager.BidSettled` (the winning-bid payout to the seller). */
export interface BidSettledEvent {
  readonly auctionId: bigint;
  readonly bidder: Address;
  readonly to: Address;
  readonly amount: bigint;
}

// ---------------------------------------------------------------------------
// FinancingMarketplace event payloads
// ---------------------------------------------------------------------------

/** Decoded `FinancingMarketplace.OfferMade`. */
export interface OfferMadeEvent {
  readonly offerId: bigint;
  readonly batchId: Bytes32;
  readonly maker: Address;
  readonly amount: bigint;
}

/** Decoded `FinancingMarketplace.OfferTaken`. */
export interface OfferTakenEvent {
  readonly offerId: bigint;
  readonly taker: Address;
}

/** Decoded `FinancingMarketplace.OfferCancelled`. */
export interface OfferCancelledEvent {
  readonly offerId: bigint;
}

// ---------------------------------------------------------------------------
// Request / response DTOs (api + web boundary)
//
// Big integers cross the JSON boundary as decimal strings.
// ---------------------------------------------------------------------------

/** Body for publishing a listing in the {ListingRegistry}. */
export interface CreateListingRequest {
  readonly kind: AssetKind;
  readonly asset: Address;
  readonly assetId: string;
  readonly amount: string;
  readonly paymentToken: Address;
  readonly price: string;
}

/** Body for starting an {AuctionHouse} auction. */
export interface StartAuctionRequest {
  readonly nft: Address;
  readonly tokenId: string;
  readonly paymentToken: Address;
  readonly reservePrice: string;
  readonly duration: string;
}

/** Body for placing a bid on an active auction. */
export interface PlaceBidRequest {
  readonly auctionId: string;
  readonly amount: string;
}

/** Body for placing an {OrderBook} limit order. */
export interface PlaceOrderRequest {
  readonly side: OrderSide;
  readonly asset: Address;
  readonly assetId: string;
  readonly paymentToken: Address;
  readonly price: string;
  readonly quantity: string;
}

/** Body for making a {FinancingMarketplace} offer against a listed receivable. */
export interface MakeOfferRequest {
  readonly batchId: Bytes32;
  readonly token: Address;
  readonly amount: string;
}

/** Read model for a listing, enriched with human labels. */
export interface ListingView {
  readonly listing: MarketListing;
  readonly kindLabel: string;
  readonly statusLabel: string;
}

/** Read model for an auction, enriched with a human label and time-to-close. */
export interface AuctionView {
  readonly auction: Auction;
  readonly stateLabel: string;
  readonly ended: boolean;
  readonly hasBids: boolean;
}

/** Read model for an order, enriched with a human label and fill progress. */
export interface OrderView {
  readonly order: Order;
  readonly sideLabel: string;
  readonly remaining: bigint;
  readonly open: boolean;
}
