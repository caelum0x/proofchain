/**
 * `tradefinance` domain types.
 *
 * TypeScript mirrors of the on-chain structs, enums and status values declared
 * by the `src/tradefinance/*` contracts (LetterOfCredit, BillOfExchange,
 * FactoringAgreement, PurchaseOrderFinancing, DynamicDiscounting,
 * SupplyChainFinance, ReceivableSecuritization, TrancheToken, CreditLineManager,
 * GuaranteeRegistry), plus the request/response DTOs the api/web consume.
 *
 * Conventions (see `./core.ts`): every field is `readonly`; `bigint` for
 * uint256/uint64, `number` for uint8/uint16; branded `Address` / `Bytes32` /
 * `Hex` come from `./core`. Numeric enum values MUST match the Solidity `enum`
 * declaration order exactly — they are read straight off-chain. Exported names
 * are contract-qualified so they stay unique when re-exported by `./index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// LetterOfCredit — mirror of `ILetterOfCredit`
// ---------------------------------------------------------------------------

/** Mirror of `ILetterOfCredit.LCState`. */
export enum LetterOfCreditState {
  None = 0,
  Issued = 1,
  DocumentsPresented = 2,
  Accepted = 3,
  Paid = 4,
  Rejected = 5,
  Expired = 6,
  Cancelled = 7,
}

export const LETTER_OF_CREDIT_STATE_LABELS: Readonly<
  Record<LetterOfCreditState, string>
> = Object.freeze({
  [LetterOfCreditState.None]: "None",
  [LetterOfCreditState.Issued]: "Issued",
  [LetterOfCreditState.DocumentsPresented]: "Documents Presented",
  [LetterOfCreditState.Accepted]: "Accepted",
  [LetterOfCreditState.Paid]: "Paid",
  [LetterOfCreditState.Rejected]: "Rejected",
  [LetterOfCreditState.Expired]: "Expired",
  [LetterOfCreditState.Cancelled]: "Cancelled",
});

/** Mirror of `ILetterOfCredit.Credit`. */
export interface LetterOfCredit {
  readonly lcId: Bytes32;
  readonly batchId: Bytes32;
  readonly applicant: Address;
  readonly beneficiary: Address;
  readonly issuer: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly expiry: bigint; // uint64
  readonly termsHash: Bytes32;
  readonly documentsHash: Bytes32;
  readonly state: LetterOfCreditState;
}

// ---------------------------------------------------------------------------
// BillOfExchange — mirror of `IBillOfExchange`
// ---------------------------------------------------------------------------

/** Mirror of `IBillOfExchange.BillState`. */
export enum BillOfExchangeState {
  None = 0,
  Drawn = 1,
  Accepted = 2,
  Endorsed = 3,
  Paid = 4,
  Dishonoured = 5,
  Cancelled = 6,
}

export const BILL_OF_EXCHANGE_STATE_LABELS: Readonly<
  Record<BillOfExchangeState, string>
> = Object.freeze({
  [BillOfExchangeState.None]: "None",
  [BillOfExchangeState.Drawn]: "Drawn",
  [BillOfExchangeState.Accepted]: "Accepted",
  [BillOfExchangeState.Endorsed]: "Endorsed",
  [BillOfExchangeState.Paid]: "Paid",
  [BillOfExchangeState.Dishonoured]: "Dishonoured",
  [BillOfExchangeState.Cancelled]: "Cancelled",
});

/** Mirror of `IBillOfExchange.Bill`. */
export interface BillOfExchange {
  readonly billId: Bytes32;
  readonly drawer: Address;
  readonly drawee: Address;
  readonly payee: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly maturity: bigint; // uint64
  readonly sight: boolean;
  readonly state: BillOfExchangeState;
}

// ---------------------------------------------------------------------------
// FactoringAgreement — mirror of `IFactoringAgreement`
// ---------------------------------------------------------------------------

/** Mirror of `IFactoringAgreement.AgreementState`. */
export enum FactoringAgreementState {
  None = 0,
  Offered = 1,
  Funded = 2,
  Collected = 3,
  Defaulted = 4,
  Cancelled = 5,
}

export const FACTORING_AGREEMENT_STATE_LABELS: Readonly<
  Record<FactoringAgreementState, string>
> = Object.freeze({
  [FactoringAgreementState.None]: "None",
  [FactoringAgreementState.Offered]: "Offered",
  [FactoringAgreementState.Funded]: "Funded",
  [FactoringAgreementState.Collected]: "Collected",
  [FactoringAgreementState.Defaulted]: "Defaulted",
  [FactoringAgreementState.Cancelled]: "Cancelled",
});

/** Mirror of `IFactoringAgreement.Agreement`. */
export interface FactoringAgreement {
  readonly agreementId: Bytes32;
  readonly batchId: Bytes32;
  readonly seller: Address;
  readonly factor: Address;
  readonly debtor: Address;
  readonly token: Address;
  readonly faceAmount: bigint;
  readonly advanceAmount: bigint;
  readonly feeBps: number; // uint16
  readonly maturity: bigint; // uint64
  readonly recourse: boolean;
  readonly state: FactoringAgreementState;
}

// ---------------------------------------------------------------------------
// PurchaseOrderFinancing — mirror of `IPurchaseOrderFinancing`
// ---------------------------------------------------------------------------

/** Mirror of `IPurchaseOrderFinancing.POState`. */
export enum PurchaseOrderState {
  None = 0,
  Registered = 1,
  Financed = 2,
  Delivered = 3,
  Repaid = 4,
  Defaulted = 5,
  Cancelled = 6,
}

export const PURCHASE_ORDER_STATE_LABELS: Readonly<
  Record<PurchaseOrderState, string>
> = Object.freeze({
  [PurchaseOrderState.None]: "None",
  [PurchaseOrderState.Registered]: "Registered",
  [PurchaseOrderState.Financed]: "Financed",
  [PurchaseOrderState.Delivered]: "Delivered",
  [PurchaseOrderState.Repaid]: "Repaid",
  [PurchaseOrderState.Defaulted]: "Defaulted",
  [PurchaseOrderState.Cancelled]: "Cancelled",
});

/** Mirror of `IPurchaseOrderFinancing.PO`. */
export interface PurchaseOrderFinance {
  readonly poId: Bytes32;
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly buyer: Address;
  readonly financier: Address;
  readonly token: Address;
  readonly poValue: bigint;
  readonly advance: bigint;
  readonly feeBps: number; // uint16
  readonly dueDate: bigint; // uint64
  readonly state: PurchaseOrderState;
}

// ---------------------------------------------------------------------------
// DynamicDiscounting — mirror of `IDynamicDiscounting`
// ---------------------------------------------------------------------------

/** Mirror of `IDynamicDiscounting.OfferState`. */
export enum DiscountOfferState {
  None = 0,
  Open = 1,
  Accepted = 2,
  Expired = 3,
  Cancelled = 4,
}

export const DISCOUNT_OFFER_STATE_LABELS: Readonly<
  Record<DiscountOfferState, string>
> = Object.freeze({
  [DiscountOfferState.None]: "None",
  [DiscountOfferState.Open]: "Open",
  [DiscountOfferState.Accepted]: "Accepted",
  [DiscountOfferState.Expired]: "Expired",
  [DiscountOfferState.Cancelled]: "Cancelled",
});

/** Mirror of `IDynamicDiscounting.Offer`. */
export interface DiscountOffer {
  readonly offerId: Bytes32;
  readonly batchId: Bytes32;
  readonly buyer: Address;
  readonly supplier: Address;
  readonly token: Address;
  readonly faceAmount: bigint;
  readonly maxDiscountBps: number; // uint16
  readonly offerStart: bigint; // uint64
  readonly dueDate: bigint; // uint64
  readonly state: DiscountOfferState;
}

// ---------------------------------------------------------------------------
// SupplyChainFinance — mirror of `ISupplyChainFinance`
// ---------------------------------------------------------------------------

/** Mirror of `ISupplyChainFinance.InvoiceState`. */
export enum SupplyChainInvoiceState {
  None = 0,
  Approved = 1,
  EarlyPaid = 2,
  Settled = 3,
  Overdue = 4,
  Cancelled = 5,
}

export const SUPPLY_CHAIN_INVOICE_STATE_LABELS: Readonly<
  Record<SupplyChainInvoiceState, string>
> = Object.freeze({
  [SupplyChainInvoiceState.None]: "None",
  [SupplyChainInvoiceState.Approved]: "Approved",
  [SupplyChainInvoiceState.EarlyPaid]: "Early Paid",
  [SupplyChainInvoiceState.Settled]: "Settled",
  [SupplyChainInvoiceState.Overdue]: "Overdue",
  [SupplyChainInvoiceState.Cancelled]: "Cancelled",
});

/** Mirror of `ISupplyChainFinance.Program`. */
export interface SupplyChainProgram {
  readonly programId: Bytes32;
  readonly anchorBuyer: Address;
  readonly funder: Address;
  readonly token: Address;
  readonly discountBps: number; // uint16
  readonly fundingLimit: bigint;
  readonly utilized: bigint;
  readonly active: boolean;
}

/** Mirror of `ISupplyChainFinance.ProgramInvoice`. */
export interface SupplyChainInvoice {
  readonly invoiceId: Bytes32;
  readonly programId: Bytes32;
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly amount: bigint;
  readonly dueDate: bigint; // uint64
  readonly state: SupplyChainInvoiceState;
}

// ---------------------------------------------------------------------------
// ReceivableSecuritization — mirror of `IReceivableSecuritization`
// ---------------------------------------------------------------------------

/** Mirror of `IReceivableSecuritization.PoolState`. */
export enum SecuritizationPoolState {
  None = 0,
  Open = 1,
  Sealed = 2,
  Distributing = 3,
  Closed = 4,
}

export const SECURITIZATION_POOL_STATE_LABELS: Readonly<
  Record<SecuritizationPoolState, string>
> = Object.freeze({
  [SecuritizationPoolState.None]: "None",
  [SecuritizationPoolState.Open]: "Open",
  [SecuritizationPoolState.Sealed]: "Sealed",
  [SecuritizationPoolState.Distributing]: "Distributing",
  [SecuritizationPoolState.Closed]: "Closed",
});

/** Mirror of `IReceivableSecuritization.Tranche`. */
export interface SecuritizationTranche {
  readonly token: Address;
  readonly seniority: number; // uint16 (0 = most senior)
  readonly principal: bigint;
  readonly couponBps: number; // uint16
  readonly distributed: bigint;
}

/** Mirror of `IReceivableSecuritization.Pool`. */
export interface SecuritizationPool {
  readonly poolId: Bytes32;
  readonly sponsor: Address;
  readonly token: Address;
  readonly totalReceivables: bigint;
  readonly collected: bigint;
  readonly trancheCount: number; // uint8
  readonly state: SecuritizationPoolState;
}

// ---------------------------------------------------------------------------
// TrancheToken — mirror of `ITrancheToken` immutable metadata
// ---------------------------------------------------------------------------

/** Immutable per-token metadata exposed by `ITrancheToken`. */
export interface TrancheTokenInfo {
  readonly token: Address;
  readonly poolId: Bytes32;
  readonly seniority: number; // uint16
}

// ---------------------------------------------------------------------------
// CreditLineManager — mirror of `ICreditLineManager`
// ---------------------------------------------------------------------------

/** Mirror of `ICreditLineManager.LineState`. */
export enum CreditLineState {
  None = 0,
  Active = 1,
  Frozen = 2,
  Closed = 3,
}

export const CREDIT_LINE_STATE_LABELS: Readonly<
  Record<CreditLineState, string>
> = Object.freeze({
  [CreditLineState.None]: "None",
  [CreditLineState.Active]: "Active",
  [CreditLineState.Frozen]: "Frozen",
  [CreditLineState.Closed]: "Closed",
});

/** Mirror of `ICreditLineManager.CreditLine`. */
export interface CreditLine {
  readonly lineId: Bytes32;
  readonly borrower: Address;
  readonly token: Address;
  readonly limit: bigint;
  readonly drawn: bigint;
  readonly accruedInterest: bigint;
  readonly aprBps: number; // uint16
  readonly lastAccrual: bigint; // uint64
  readonly state: CreditLineState;
}

// ---------------------------------------------------------------------------
// GuaranteeRegistry — mirror of `IGuaranteeRegistry`
// ---------------------------------------------------------------------------

/** Mirror of `IGuaranteeRegistry.GuaranteeType`. */
export enum GuaranteeType {
  Performance = 0,
  Payment = 1,
  BidBond = 2,
  AdvancePayment = 3,
  Standby = 4,
}

export const GUARANTEE_TYPE_LABELS: Readonly<Record<GuaranteeType, string>> =
  Object.freeze({
    [GuaranteeType.Performance]: "Performance",
    [GuaranteeType.Payment]: "Payment",
    [GuaranteeType.BidBond]: "Bid Bond",
    [GuaranteeType.AdvancePayment]: "Advance Payment",
    [GuaranteeType.Standby]: "Standby",
  });

/** Mirror of `IGuaranteeRegistry.GuaranteeState`. */
export enum GuaranteeState {
  None = 0,
  Issued = 1,
  Called = 2,
  PaidOut = 3,
  Released = 4,
  Expired = 5,
}

export const GUARANTEE_STATE_LABELS: Readonly<Record<GuaranteeState, string>> =
  Object.freeze({
    [GuaranteeState.None]: "None",
    [GuaranteeState.Issued]: "Issued",
    [GuaranteeState.Called]: "Called",
    [GuaranteeState.PaidOut]: "Paid Out",
    [GuaranteeState.Released]: "Released",
    [GuaranteeState.Expired]: "Expired",
  });

/** Mirror of `IGuaranteeRegistry.Guarantee`. */
export interface Guarantee {
  readonly guaranteeId: Bytes32;
  readonly gType: GuaranteeType;
  readonly guarantor: Address;
  readonly principal: Address;
  readonly beneficiary: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly expiry: bigint; // uint64
  readonly termsHash: Bytes32;
  readonly state: GuaranteeState;
}

// ---------------------------------------------------------------------------
// Request / response DTOs consumed by the api + web layers
// ---------------------------------------------------------------------------

/** Discriminant for the trade-finance instrument kinds surfaced by the API. */
export type TradeFinanceInstrumentKind =
  | "letter-of-credit"
  | "bill-of-exchange"
  | "factoring"
  | "purchase-order-financing"
  | "dynamic-discounting"
  | "supply-chain-finance"
  | "securitization"
  | "credit-line"
  | "guarantee";

/** All trade-finance instrument-kind discriminants, in catalog order. */
export const TRADE_FINANCE_INSTRUMENT_KINDS: readonly TradeFinanceInstrumentKind[] =
  Object.freeze([
    "letter-of-credit",
    "bill-of-exchange",
    "factoring",
    "purchase-order-financing",
    "dynamic-discounting",
    "supply-chain-finance",
    "securitization",
    "credit-line",
    "guarantee",
  ]);

/** Common list/pagination query accepted by trade-finance list endpoints. */
export interface TradeFinanceListQuery {
  readonly kind?: TradeFinanceInstrumentKind;
  /** Filter to instruments involving this party (any role). */
  readonly party?: Address;
  /** Filter to instruments settled in this payment token. */
  readonly token?: Address;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Cross-instrument summary row for trade-finance dashboards. `state` is the raw
 * on-chain enum ordinal for the given `kind`; `stateLabel` is a display string.
 */
export interface TradeFinanceSummary {
  readonly kind: TradeFinanceInstrumentKind;
  readonly id: Bytes32;
  readonly counterparties: readonly Address[];
  readonly token: Address;
  readonly amount: bigint;
  readonly state: number;
  readonly stateLabel: string;
}
