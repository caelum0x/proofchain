/**
 * `payments` domain types — settlement escrow, routing, fees, and treasury.
 *
 * The core escrow struct/enum (`Deal`, `DealState`) and the accepted-token
 * struct (`TokenInfo`) already live in `./core` and are re-exported from the
 * package root. This module adds the decoded-event payloads for the settlement,
 * routing, fee, and treasury contracts plus the request/response DTOs the
 * api/web consume.
 *
 * Field typing rules (match viem's decoded output): `bigint` for uint256,
 * `number` for uint8/uint16, branded `Address`/`Bytes32` for addresses/hashes.
 * Every field is `readonly`.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// SettlementEscrow / SettlementRouter events
// ---------------------------------------------------------------------------

/** `SettlementEscrow.Funded(batchId, buyer, supplier, token, amount)`. */
export interface EscrowFundedEvent {
  readonly eventName: "Funded";
  readonly batchId: Bytes32;
  readonly buyer: Address;
  readonly supplier: Address;
  readonly token: Address;
  readonly amount: bigint;
}

/** `SettlementEscrow.Released(batchId, supplier, amount)`. */
export interface EscrowReleasedEvent {
  readonly eventName: "Released";
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly amount: bigint;
}

/** `SettlementEscrow.Refunded(batchId, buyer, amount)`. */
export interface EscrowRefundedEvent {
  readonly eventName: "Refunded";
  readonly batchId: Bytes32;
  readonly buyer: Address;
  readonly amount: bigint;
}

/** `SettlementEscrow.Disputed(batchId, score)`. */
export interface EscrowDisputedEvent {
  readonly eventName: "Disputed";
  readonly batchId: Bytes32;
  readonly score: number; // uint16 bps
}

/** `SettlementEscrow.PayeeSet(batchId, payee)`. */
export interface PayeeSetEvent {
  readonly eventName: "PayeeSet";
  readonly batchId: Bytes32;
  readonly payee: Address;
}

/** `SettlementEscrow.ArbiterReleased(batchId, payee, amount)`. */
export interface ArbiterReleasedEvent {
  readonly eventName: "ArbiterReleased";
  readonly batchId: Bytes32;
  readonly payee: Address;
  readonly amount: bigint;
}

/** `SettlementEscrow.PassThresholdUpdated(oldT, newT)`. */
export interface PassThresholdUpdatedEvent {
  readonly eventName: "PassThresholdUpdated";
  readonly oldT: number; // uint16 bps
  readonly newT: number; // uint16 bps
}

/** `SettlementRouter.FullySettled(batchId, released, score)`. */
export interface FullySettledEvent {
  readonly eventName: "FullySettled";
  readonly batchId: Bytes32;
  readonly released: boolean;
  readonly score: number; // uint16 bps
}

// ---------------------------------------------------------------------------
// EscrowFactory / PaymentRouter events
// ---------------------------------------------------------------------------

/** `EscrowFactory.EscrowCreated(salt, escrow, admin)`. */
export interface EscrowCreatedEvent {
  readonly eventName: "EscrowCreated";
  readonly salt: Bytes32;
  readonly escrow: Address;
  readonly admin: Address;
}

/** `PaymentRouter.Routed(action, token, payer, destination, amount, fee)`. */
export interface PaymentRoutedEvent {
  readonly eventName: "Routed";
  readonly action: Bytes32;
  readonly token: Address;
  readonly payer: Address;
  readonly destination: Address;
  readonly amount: bigint;
  readonly fee: bigint;
}

// ---------------------------------------------------------------------------
// StablecoinRegistry / FeeManager / Treasury events
// ---------------------------------------------------------------------------

/** `StablecoinRegistry.TokenAdded(token, decimals)`. */
export interface TokenAddedEvent {
  readonly eventName: "TokenAdded";
  readonly token: Address;
  readonly decimals: number; // uint8
}

/** `StablecoinRegistry.TokenRemoved(token)`. */
export interface TokenRemovedEvent {
  readonly eventName: "TokenRemoved";
  readonly token: Address;
}

/** `FeeManager.FeeBpsSet(action, bps)`. */
export interface FeeBpsSetEvent {
  readonly eventName: "FeeBpsSet";
  readonly action: Bytes32;
  readonly bps: number; // uint16
}

/** `FeeManager.FeeCollected(action, token, payer, amount)`. */
export interface FeeCollectedEvent {
  readonly eventName: "FeeCollected";
  readonly action: Bytes32;
  readonly token: Address;
  readonly payer: Address;
  readonly amount: bigint;
}

/** `Treasury.Deposit(from, token, amount)`. */
export interface TreasuryDepositEvent {
  readonly eventName: "Deposit";
  readonly from: Address;
  readonly token: Address;
  readonly amount: bigint;
}

/** `Treasury.Withdraw(to, token, amount)`. */
export interface TreasuryWithdrawEvent {
  readonly eventName: "Withdraw";
  readonly to: Address;
  readonly token: Address;
  readonly amount: bigint;
}

/** Ordered tuple of every decodable payments event name. */
export const PAYMENTS_EVENT_NAMES = [
  "Funded",
  "Released",
  "Refunded",
  "Disputed",
  "PayeeSet",
  "ArbiterReleased",
  "PassThresholdUpdated",
  "FullySettled",
  "EscrowCreated",
  "Routed",
  "TokenAdded",
  "TokenRemoved",
  "FeeBpsSet",
  "FeeCollected",
  "Deposit",
  "Withdraw",
] as const;

export type PaymentsEventName = (typeof PAYMENTS_EVENT_NAMES)[number];

/** Discriminated union of every decoded payments event payload. */
export type PaymentsDomainEvent =
  | EscrowFundedEvent
  | EscrowReleasedEvent
  | EscrowRefundedEvent
  | EscrowDisputedEvent
  | PayeeSetEvent
  | ArbiterReleasedEvent
  | PassThresholdUpdatedEvent
  | FullySettledEvent
  | EscrowCreatedEvent
  | PaymentRoutedEvent
  | TokenAddedEvent
  | TokenRemovedEvent
  | FeeBpsSetEvent
  | FeeCollectedEvent
  | TreasuryDepositEvent
  | TreasuryWithdrawEvent;

// ---------------------------------------------------------------------------
// View DTOs
// ---------------------------------------------------------------------------

/** Fee schedule entry: bps configured for a named action key. */
export interface FeeScheduleEntry {
  readonly action: Bytes32;
  readonly bps: number; // uint16
}

/** Computed fee breakdown for a gross amount under an action. */
export interface FeeQuote {
  readonly action: Bytes32;
  readonly gross: bigint;
  readonly fee: bigint;
  readonly net: bigint;
}

/** Treasury balance for a single token. */
export interface TreasuryBalance {
  readonly token: Address;
  readonly balance: bigint;
}

// ---------------------------------------------------------------------------
// Request DTOs (write-endpoint inputs). uint256 amounts are decimal strings.
// ---------------------------------------------------------------------------

/** Body for `SettlementEscrow.fund`. */
export interface FundDealInput {
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly token: Address;
  readonly amount: string;
}

/** Body for `SettlementEscrow.setPayee` (invoice-financing assignment). */
export interface SetPayeeInput {
  readonly batchId: Bytes32;
  readonly payee: Address;
}

/** Body for `PaymentRouter.pay`. */
export interface RoutePaymentInput {
  readonly action: Bytes32;
  readonly token: Address;
  readonly destination: Address;
  readonly amount: string;
}
