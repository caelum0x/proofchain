/**
 * `commodities` domain types.
 *
 * Mirrors the on-chain structs, events, and status enums of the contracts in
 * `packages/contracts/src/commodities/` and their `interfaces/`:
 * `CommodityToken`, `HarvestRegistry`, `GradingRegistry`, `StorageReceipt`,
 * `PriceOracle`, `CommodityVault`.
 *
 * Conventions (see `./core`): every field `readonly`; `bigint` for
 * uint256/uint64; `number` for uint8/uint16/uint32; branded `Address` /
 * `Bytes32`. Numeric enum values MUST match the Solidity `enum` order exactly.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Mirror of `IHarvestRegistry.HarvestState`. */
export enum HarvestState {
  None = 0,
  Registered = 1,
  Graded = 2,
  Stored = 3,
  Consumed = 4,
}

export const HARVEST_STATE_LABELS: Readonly<Record<HarvestState, string>> =
  Object.freeze({
    [HarvestState.None]: "None",
    [HarvestState.Registered]: "Registered",
    [HarvestState.Graded]: "Graded",
    [HarvestState.Stored]: "Stored",
    [HarvestState.Consumed]: "Consumed",
  });

/** Mirror of `IStorageReceipt.ReceiptState`. */
export enum ReceiptState {
  None = 0,
  Issued = 1,
  Pledged = 2,
  Redeemed = 3,
  Cancelled = 4,
}

export const RECEIPT_STATE_LABELS: Readonly<Record<ReceiptState, string>> =
  Object.freeze({
    [ReceiptState.None]: "None",
    [ReceiptState.Issued]: "Issued",
    [ReceiptState.Pledged]: "Pledged",
    [ReceiptState.Redeemed]: "Redeemed",
    [ReceiptState.Cancelled]: "Cancelled",
  });

/** Mirror of `ICommodityVault.PositionState`. */
export enum PositionState {
  None = 0,
  Collateralized = 1,
  Redeemed = 2,
}

export const POSITION_STATE_LABELS: Readonly<Record<PositionState, string>> =
  Object.freeze({
    [PositionState.None]: "None",
    [PositionState.Collateralized]: "Collateralized",
    [PositionState.Redeemed]: "Redeemed",
  });

// ---------------------------------------------------------------------------
// On-chain struct mirrors
// ---------------------------------------------------------------------------

/** Mirror of `IHarvestRegistry.Harvest`. */
export interface Harvest {
  readonly harvestId: Bytes32;
  readonly producer: Address;
  readonly crop: Bytes32;
  readonly farmGeohash: Bytes32;
  readonly season: Bytes32;
  readonly quantityKg: bigint;
  readonly harvestedAt: bigint; // uint64
  readonly metadataHash: Bytes32;
  readonly state: HarvestState;
}

/** Mirror of `IGradingRegistry.Grading`. */
export interface Grading {
  readonly gradingId: Bytes32;
  readonly lotId: Bytes32;
  readonly standard: Bytes32;
  readonly grade: Bytes32;
  readonly score: number; // uint16 bps
  readonly grader: Address;
  readonly evidenceHash: Bytes32;
  readonly gradedAt: bigint; // uint64
  readonly revoked: boolean;
}

/** Mirror of `IStorageReceipt.Receipt`. */
export interface StorageReceipt {
  readonly receiptId: Bytes32;
  readonly warehouseId: Bytes32;
  readonly holder: Address;
  readonly commodityCode: Bytes32;
  readonly grade: Bytes32;
  readonly quantityKg: bigint;
  readonly issuedAt: bigint; // uint64
  readonly expiresAt: bigint; // uint64
  readonly lienHolder: Address;
  readonly state: ReceiptState;
}

/** Mirror of `IPriceOracle.Feed`. */
export interface PriceFeed {
  readonly symbol: Bytes32;
  readonly decimals: number; // uint8
  readonly price: bigint;
  readonly updatedAt: bigint; // uint64
  readonly heartbeat: number; // uint32 (seconds)
  readonly active: boolean;
}

/** Mirror of `ICommodityVault.Position`. */
export interface VaultPosition {
  readonly receiptId: Bytes32;
  readonly holder: Address;
  readonly commodityCode: Bytes32;
  readonly tokenAmount: bigint;
  readonly depositedAt: bigint; // uint64
  readonly state: PositionState;
}

// ---------------------------------------------------------------------------
// Event payload mirrors (decoded by `../decoders/commodities`)
// ---------------------------------------------------------------------------

/** Payload of `CommodityToken.Minted`. */
export interface CommodityMintedEvent {
  readonly to: Address;
  readonly amount: bigint;
  readonly receiptId: Bytes32;
}

/** Payload of `CommodityToken.Burned`. */
export interface CommodityBurnedEvent {
  readonly from: Address;
  readonly amount: bigint;
  readonly receiptId: Bytes32;
}

/** Payload of `HarvestRegistry.HarvestRegistered`. */
export interface HarvestRegisteredEvent {
  readonly harvestId: Bytes32;
  readonly producer: Address;
  readonly crop: Bytes32;
  readonly quantityKg: bigint;
  readonly season: Bytes32;
}

/** Payload of `GradingRegistry.Graded`. */
export interface GradedEvent {
  readonly gradingId: Bytes32;
  readonly lotId: Bytes32;
  readonly standard: Bytes32;
  readonly grade: Bytes32;
  readonly score: number;
  readonly grader: Address;
}

/** Payload of `StorageReceipt.ReceiptIssued`. */
export interface ReceiptIssuedEvent {
  readonly receiptId: Bytes32;
  readonly warehouseId: Bytes32;
  readonly holder: Address;
  readonly commodityCode: Bytes32;
  readonly quantityKg: bigint;
}

/** Payload of `PriceOracle.PriceUpdated`. */
export interface PriceUpdatedEvent {
  readonly symbol: Bytes32;
  readonly price: bigint;
  readonly updatedAt: bigint;
}

/** Payload of `CommodityVault.Deposited`. */
export interface VaultDepositedEvent {
  readonly receiptId: Bytes32;
  readonly holder: Address;
  readonly commodityCode: Bytes32;
  readonly tokenAmount: bigint;
}

/** Payload of `CommodityVault.Redeemed`. */
export interface VaultRedeemedEvent {
  readonly receiptId: Bytes32;
  readonly holder: Address;
  readonly tokenAmount: bigint;
}

// ---------------------------------------------------------------------------
// Request / response DTOs (consumed by api + web)
// ---------------------------------------------------------------------------

/** Filter parameters for a harvest listing endpoint. */
export interface HarvestListQuery {
  readonly producer?: Address;
  readonly crop?: Bytes32;
  readonly season?: Bytes32;
  readonly state?: HarvestState;
  readonly limit?: number;
  readonly cursor?: string;
}

/** Denormalized harvest row for list/detail views. */
export interface HarvestSummary {
  readonly harvestId: Bytes32;
  readonly producer: Address;
  readonly crop: Bytes32;
  readonly season: Bytes32;
  readonly quantityKg: bigint;
  readonly harvestedAt: bigint;
  readonly state: HarvestState;
  readonly stateLabel: string;
  readonly grade: Bytes32 | null;
}

/** Latest spot-price view for a commodity symbol. */
export interface CommodityQuote {
  readonly symbol: Bytes32;
  readonly price: bigint;
  readonly decimals: number;
  readonly updatedAt: bigint;
  readonly stale: boolean;
}
