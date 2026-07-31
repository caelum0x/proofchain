/**
 * `finance` domain types — invoice financing / receivable RWA layer.
 *
 * The primary on-chain struct mirrors (`ReceivableTerms`, `InvoiceListing`) and
 * the `InvoiceListingState` enum live in `./core` (they are read straight off
 * the chain by the settlement flow). This module adds the remaining pieces the
 * api/web need: strongly-typed decoded-event payloads for every key finance
 * event, view DTOs for the pool/vault/discount calculators, and request DTOs
 * for the write endpoints.
 *
 * Field typing rules (match viem's decoded output): `bigint` for uint256/uint64,
 * `number` for uint8/uint16, branded `Address`/`Bytes32` for addresses/hashes.
 * Every field is `readonly`.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// Decoded event payloads. Each carries a literal `eventName` discriminant so
// consumers can switch over {@link FinanceDomainEvent} exhaustively.
// ---------------------------------------------------------------------------

/** `ReceivableRegistry.ReceivableRegistered(batchId, faceValue, dueDate, obligor, token)`. */
export interface ReceivableRegisteredEvent {
  readonly eventName: "ReceivableRegistered";
  readonly batchId: Bytes32;
  readonly faceValue: bigint;
  readonly dueDate: bigint; // uint64 unix seconds
  readonly obligor: Address;
  readonly token: Address;
}

/** `InvoiceNFT.ReceivableMinted(batchId, tokenId, to)`. */
export interface ReceivableMintedEvent {
  readonly eventName: "ReceivableMinted";
  readonly batchId: Bytes32;
  readonly tokenId: bigint;
  readonly to: Address;
}

/** `InvoiceFinancing.Listed(batchId, supplier, token, askAmount)`. */
export interface InvoiceListedEvent {
  readonly eventName: "Listed";
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly token: Address;
  readonly askAmount: bigint;
}

/** `InvoiceFinancing.Funded(batchId, lender, amount)`. */
export interface InvoiceFundedEvent {
  readonly eventName: "Funded";
  readonly batchId: Bytes32;
  readonly lender: Address;
  readonly amount: bigint;
}

/** `InvoiceFinancing.Claimed(batchId, lender, principal, remainderToSupplier)`. */
export interface InvoiceClaimedEvent {
  readonly eventName: "Claimed";
  readonly batchId: Bytes32;
  readonly lender: Address;
  readonly principal: bigint;
  readonly remainderToSupplier: bigint;
}

/** `InvoiceFinancing.Cancelled(batchId)`. */
export interface InvoiceCancelledEvent {
  readonly eventName: "Cancelled";
  readonly batchId: Bytes32;
}

/** `FinancingPool.Deposited(lender, assets, shares)`. */
export interface PoolDepositedEvent {
  readonly eventName: "Deposited";
  readonly lender: Address;
  readonly assets: bigint;
  readonly shares: bigint;
}

/** `FinancingPool.Withdrawn(lender, assets, shares)`. */
export interface PoolWithdrawnEvent {
  readonly eventName: "Withdrawn";
  readonly lender: Address;
  readonly assets: bigint;
  readonly shares: bigint;
}

/** `FinancingPool.Allocated(batchId, amount)`. */
export interface PoolAllocatedEvent {
  readonly eventName: "Allocated";
  readonly batchId: Bytes32;
  readonly amount: bigint;
}

/** `FinancingPool.Reconciled(batchId, principal, returned)`. */
export interface PoolReconciledEvent {
  readonly eventName: "Reconciled";
  readonly batchId: Bytes32;
  readonly principal: bigint;
  readonly returned: bigint;
}

/** `FinancingPool.MaxGradeUpdated(maxGrade)`. */
export interface MaxGradeUpdatedEvent {
  readonly eventName: "MaxGradeUpdated";
  readonly maxGrade: number; // uint8 risk grade
}

/** `RepaymentController.Repaid(batchId, lender, principalPlusFee, remainder)`. */
export interface RepaidEvent {
  readonly eventName: "Repaid";
  readonly batchId: Bytes32;
  readonly lender: Address;
  readonly principalPlusFee: bigint;
  readonly remainder: bigint;
}

/** `YieldDistributor.YieldDistributed(poolId, token, amount)`. */
export interface YieldDistributedEvent {
  readonly eventName: "YieldDistributed";
  readonly poolId: Bytes32;
  readonly token: Address;
  readonly amount: bigint;
}

/** Ordered tuple of every decodable finance event name. */
export const FINANCE_EVENT_NAMES = [
  "ReceivableRegistered",
  "ReceivableMinted",
  "Listed",
  "Funded",
  "Claimed",
  "Cancelled",
  "Deposited",
  "Withdrawn",
  "Allocated",
  "Reconciled",
  "MaxGradeUpdated",
  "Repaid",
  "YieldDistributed",
] as const;

export type FinanceEventName = (typeof FINANCE_EVENT_NAMES)[number];

/** Discriminated union of every decoded finance event payload. */
export type FinanceDomainEvent =
  | ReceivableRegisteredEvent
  | ReceivableMintedEvent
  | InvoiceListedEvent
  | InvoiceFundedEvent
  | InvoiceClaimedEvent
  | InvoiceCancelledEvent
  | PoolDepositedEvent
  | PoolWithdrawnEvent
  | PoolAllocatedEvent
  | PoolReconciledEvent
  | MaxGradeUpdatedEvent
  | RepaidEvent
  | YieldDistributedEvent;

// ---------------------------------------------------------------------------
// View DTOs (aggregated read-model shapes surfaced by the api/web).
// ---------------------------------------------------------------------------

/** Snapshot of a `FinancingPool` (from `totalLiquidity()` / `maxGrade()`). */
export interface FinancingPoolInfo {
  readonly totalLiquidity: bigint;
  readonly maxGrade: number; // uint8: worst risk grade the pool will fund
}

/** ERC4626 view of a `LenderVault` position/state. */
export interface LenderVaultInfo {
  readonly asset: Address;
  readonly totalAssets: bigint;
  readonly totalShares: bigint;
}

/** Result of `DiscountCalculator.advanceFor` / `discountBps` for a receivable. */
export interface DiscountQuote {
  readonly faceValue: bigint;
  readonly grade: number; // uint8 risk grade (1 best .. 7 worst)
  readonly tenorDays: number;
  readonly advance: bigint; // amount payable now
  readonly discountBps: number; // uint16 basis points withheld
}

// ---------------------------------------------------------------------------
// Request DTOs (write-endpoint inputs). uint256 amounts are decimal strings so
// the payloads stay JSON-serializable across the api/web boundary.
// ---------------------------------------------------------------------------

/** Body for supplier-lists-a-receivable (`InvoiceFinancing.list`). */
export interface ListReceivableInput {
  readonly batchId: Bytes32;
  readonly askAmount: string;
}

/** Body for lender-funds / supplier-claims / cancel (`InvoiceFinancing`). */
export interface InvoiceBatchInput {
  readonly batchId: Bytes32;
}

/** Body for `FinancingPool.deposit`. */
export interface PoolDepositInput {
  readonly assets: string;
}

/** Body for `FinancingPool.withdraw`. */
export interface PoolWithdrawInput {
  readonly shares: string;
}
