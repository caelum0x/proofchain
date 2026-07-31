/**
 * `tradefinance` domain event decoders.
 *
 * Typed viem-log decoders for the key events emitted by the `src/tradefinance/*`
 * contracts. Each decoder asserts the log belongs to the expected
 * contract+event (throwing {@link DecodeError} otherwise), then narrows viem's
 * loosely-typed `args` record into an immutable, strongly-typed event object
 * (throwing {@link ValidationError} on a malformed field). viem returns every
 * Solidity integer as `bigint`; small uints (uint8/uint16) are range-checked
 * and narrowed to `number` to match the mirrors in `../types/tradefinance`.
 *
 * Re-exported by `../decoders/index.ts`.
 */
import type { ContractName } from "../abis/index";
import { DecodeError, ValidationError } from "../errors";
import type { Address, Bytes32 } from "../types/core";
import { GuaranteeType } from "../types/tradefinance";
import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Internal field-reader helpers (strict, immutable, no unsound `any`)
// ---------------------------------------------------------------------------

type EventArgs = Readonly<Record<string, unknown>>;

/** Decode `log` and assert it is `contract`'s `eventName` event. */
function requireEvent(
  contract: ContractName,
  eventName: string,
  log: unknown,
): EventArgs {
  const decoded = decodeContractEvent(contract, log);
  if (decoded === null || decoded.eventName !== eventName) {
    throw new DecodeError(`Log is not a ${contract}.${eventName} event`, {
      details: { expected: eventName, actual: decoded?.eventName ?? null },
    });
  }
  return decoded.args;
}

function field(args: EventArgs, key: string): unknown {
  if (!(key in args)) {
    throw new ValidationError(`Missing event field "${key}"`, { key });
  }
  return args[key];
}

/**
 * Read a uint field as `bigint`. viem returns `bigint` for uint56..uint256 and
 * `number` for uint8..uint48; both are accepted and normalized to `bigint`.
 */
function asBigInt(args: EventArgs, key: string): bigint {
  const value = field(args, key);
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return BigInt(value);
  }
  throw new ValidationError(`Field "${key}" is not a uint`, {
    key,
    type: typeof value,
  });
}

/**
 * Read a small uint (uint8/16/32) as a safe JS `number`. Accepts viem's `number`
 * (small uints) or `bigint` (if wider), range-checking the latter.
 */
function asNumber(args: EventArgs, key: string): number {
  const value = field(args, key);
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (
    typeof value === "bigint" &&
    value >= 0n &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return Number(value);
  }
  throw new ValidationError(`Field "${key}" is not a small uint`, {
    key,
    type: typeof value,
  });
}

function asAddress(args: EventArgs, key: string): Address {
  const value = field(args, key);
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/u.test(value)) {
    throw new ValidationError(`Field "${key}" is not an address`, { key });
  }
  return value as Address;
}

function asBytes32(args: EventArgs, key: string): Bytes32 {
  const value = field(args, key);
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(value)) {
    throw new ValidationError(`Field "${key}" is not a bytes32`, { key });
  }
  return value as Bytes32;
}

// ---------------------------------------------------------------------------
// LetterOfCredit
// ---------------------------------------------------------------------------

export interface LetterOfCreditIssuedEvent {
  readonly lcId: Bytes32;
  readonly batchId: Bytes32;
  readonly beneficiary: Address;
  readonly applicant: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly expiry: bigint;
}

export function decodeLetterOfCreditIssued(
  log: unknown,
): LetterOfCreditIssuedEvent {
  const a = requireEvent("LetterOfCredit", "Issued", log);
  return Object.freeze({
    lcId: asBytes32(a, "lcId"),
    batchId: asBytes32(a, "batchId"),
    beneficiary: asAddress(a, "beneficiary"),
    applicant: asAddress(a, "applicant"),
    token: asAddress(a, "token"),
    amount: asBigInt(a, "amount"),
    expiry: asBigInt(a, "expiry"),
  });
}

export interface LetterOfCreditPaidEvent {
  readonly lcId: Bytes32;
  readonly beneficiary: Address;
  readonly amount: bigint;
}

export function decodeLetterOfCreditPaid(
  log: unknown,
): LetterOfCreditPaidEvent {
  const a = requireEvent("LetterOfCredit", "Paid", log);
  return Object.freeze({
    lcId: asBytes32(a, "lcId"),
    beneficiary: asAddress(a, "beneficiary"),
    amount: asBigInt(a, "amount"),
  });
}

// ---------------------------------------------------------------------------
// BillOfExchange
// ---------------------------------------------------------------------------

export interface BillDrawnEvent {
  readonly billId: Bytes32;
  readonly drawer: Address;
  readonly drawee: Address;
  readonly payee: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly maturity: bigint;
}

export function decodeBillDrawn(log: unknown): BillDrawnEvent {
  const a = requireEvent("BillOfExchange", "Drawn", log);
  return Object.freeze({
    billId: asBytes32(a, "billId"),
    drawer: asAddress(a, "drawer"),
    drawee: asAddress(a, "drawee"),
    payee: asAddress(a, "payee"),
    token: asAddress(a, "token"),
    amount: asBigInt(a, "amount"),
    maturity: asBigInt(a, "maturity"),
  });
}

// ---------------------------------------------------------------------------
// FactoringAgreement
// ---------------------------------------------------------------------------

export interface FactoringOfferedEvent {
  readonly agreementId: Bytes32;
  readonly batchId: Bytes32;
  readonly seller: Address;
  readonly token: Address;
  readonly faceAmount: bigint;
  readonly advanceRateBps: number;
  readonly feeBps: number;
}

export function decodeFactoringOffered(log: unknown): FactoringOfferedEvent {
  const a = requireEvent("FactoringAgreement", "Offered", log);
  return Object.freeze({
    agreementId: asBytes32(a, "agreementId"),
    batchId: asBytes32(a, "batchId"),
    seller: asAddress(a, "seller"),
    token: asAddress(a, "token"),
    faceAmount: asBigInt(a, "faceAmount"),
    advanceRateBps: asNumber(a, "advanceRateBps"),
    feeBps: asNumber(a, "feeBps"),
  });
}

export interface FactoringCollectedEvent {
  readonly agreementId: Bytes32;
  readonly collected: bigint;
  readonly fee: bigint;
  readonly rebateToSeller: bigint;
}

export function decodeFactoringCollected(
  log: unknown,
): FactoringCollectedEvent {
  const a = requireEvent("FactoringAgreement", "Collected", log);
  return Object.freeze({
    agreementId: asBytes32(a, "agreementId"),
    collected: asBigInt(a, "collected"),
    fee: asBigInt(a, "fee"),
    rebateToSeller: asBigInt(a, "rebateToSeller"),
  });
}

// ---------------------------------------------------------------------------
// PurchaseOrderFinancing
// ---------------------------------------------------------------------------

export interface PurchaseOrderRegisteredEvent {
  readonly poId: Bytes32;
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly buyer: Address;
  readonly poValue: bigint;
}

export function decodePurchaseOrderRegistered(
  log: unknown,
): PurchaseOrderRegisteredEvent {
  const a = requireEvent("PurchaseOrderFinancing", "Registered", log);
  return Object.freeze({
    poId: asBytes32(a, "poId"),
    batchId: asBytes32(a, "batchId"),
    supplier: asAddress(a, "supplier"),
    buyer: asAddress(a, "buyer"),
    poValue: asBigInt(a, "poValue"),
  });
}

export interface PurchaseOrderFinancedEvent {
  readonly poId: Bytes32;
  readonly financier: Address;
  readonly advance: bigint;
  readonly feeBps: number;
}

export function decodePurchaseOrderFinanced(
  log: unknown,
): PurchaseOrderFinancedEvent {
  const a = requireEvent("PurchaseOrderFinancing", "Financed", log);
  return Object.freeze({
    poId: asBytes32(a, "poId"),
    financier: asAddress(a, "financier"),
    advance: asBigInt(a, "advance"),
    feeBps: asNumber(a, "feeBps"),
  });
}

// ---------------------------------------------------------------------------
// DynamicDiscounting
// ---------------------------------------------------------------------------

export interface DiscountOfferOpenedEvent {
  readonly offerId: Bytes32;
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly buyer: Address;
  readonly faceAmount: bigint;
  readonly maxDiscountBps: number;
  readonly dueDate: bigint;
}

export function decodeDiscountOfferOpened(
  log: unknown,
): DiscountOfferOpenedEvent {
  const a = requireEvent("DynamicDiscounting", "OfferOpened", log);
  return Object.freeze({
    offerId: asBytes32(a, "offerId"),
    batchId: asBytes32(a, "batchId"),
    supplier: asAddress(a, "supplier"),
    buyer: asAddress(a, "buyer"),
    faceAmount: asBigInt(a, "faceAmount"),
    maxDiscountBps: asNumber(a, "maxDiscountBps"),
    dueDate: asBigInt(a, "dueDate"),
  });
}

export interface DiscountOfferAcceptedEvent {
  readonly offerId: Bytes32;
  readonly discountBps: bigint;
  readonly paidAmount: bigint;
}

export function decodeDiscountOfferAccepted(
  log: unknown,
): DiscountOfferAcceptedEvent {
  const a = requireEvent("DynamicDiscounting", "OfferAccepted", log);
  return Object.freeze({
    offerId: asBytes32(a, "offerId"),
    discountBps: asBigInt(a, "discountBps"),
    paidAmount: asBigInt(a, "paidAmount"),
  });
}

// ---------------------------------------------------------------------------
// SupplyChainFinance
// ---------------------------------------------------------------------------

export interface SupplyChainProgramCreatedEvent {
  readonly programId: Bytes32;
  readonly anchorBuyer: Address;
  readonly funder: Address;
  readonly token: Address;
  readonly fundingLimit: bigint;
}

export function decodeSupplyChainProgramCreated(
  log: unknown,
): SupplyChainProgramCreatedEvent {
  const a = requireEvent("SupplyChainFinance", "ProgramCreated", log);
  return Object.freeze({
    programId: asBytes32(a, "programId"),
    anchorBuyer: asAddress(a, "anchorBuyer"),
    funder: asAddress(a, "funder"),
    token: asAddress(a, "token"),
    fundingLimit: asBigInt(a, "fundingLimit"),
  });
}

export interface SupplyChainEarlyPaidEvent {
  readonly invoiceId: Bytes32;
  readonly supplier: Address;
  readonly paidAmount: bigint;
  readonly discount: bigint;
}

export function decodeSupplyChainEarlyPaid(
  log: unknown,
): SupplyChainEarlyPaidEvent {
  const a = requireEvent("SupplyChainFinance", "EarlyPaid", log);
  return Object.freeze({
    invoiceId: asBytes32(a, "invoiceId"),
    supplier: asAddress(a, "supplier"),
    paidAmount: asBigInt(a, "paidAmount"),
    discount: asBigInt(a, "discount"),
  });
}

// ---------------------------------------------------------------------------
// ReceivableSecuritization
// ---------------------------------------------------------------------------

export interface TrancheDefinedEvent {
  readonly poolId: Bytes32;
  readonly trancheIndex: number;
  readonly trancheToken: Address;
  readonly seniority: number;
  readonly principal: bigint;
  readonly couponBps: number;
}

export function decodeTrancheDefined(log: unknown): TrancheDefinedEvent {
  const a = requireEvent("ReceivableSecuritization", "TrancheDefined", log);
  return Object.freeze({
    poolId: asBytes32(a, "poolId"),
    trancheIndex: asNumber(a, "trancheIndex"),
    trancheToken: asAddress(a, "trancheToken"),
    seniority: asNumber(a, "seniority"),
    principal: asBigInt(a, "principal"),
    couponBps: asNumber(a, "couponBps"),
  });
}

export interface TrancheDistributedEvent {
  readonly poolId: Bytes32;
  readonly trancheIndex: number;
  readonly amount: bigint;
}

export function decodeTrancheDistributed(
  log: unknown,
): TrancheDistributedEvent {
  const a = requireEvent("ReceivableSecuritization", "Distributed", log);
  return Object.freeze({
    poolId: asBytes32(a, "poolId"),
    trancheIndex: asNumber(a, "trancheIndex"),
    amount: asBigInt(a, "amount"),
  });
}

// ---------------------------------------------------------------------------
// CreditLineManager
// ---------------------------------------------------------------------------

export interface CreditLineOpenedEvent {
  readonly lineId: Bytes32;
  readonly borrower: Address;
  readonly token: Address;
  readonly limit: bigint;
  readonly aprBps: number;
}

export function decodeCreditLineOpened(log: unknown): CreditLineOpenedEvent {
  const a = requireEvent("CreditLineManager", "LineOpened", log);
  return Object.freeze({
    lineId: asBytes32(a, "lineId"),
    borrower: asAddress(a, "borrower"),
    token: asAddress(a, "token"),
    limit: asBigInt(a, "limit"),
    aprBps: asNumber(a, "aprBps"),
  });
}

export interface CreditLineRepaidEvent {
  readonly lineId: Bytes32;
  readonly principalPaid: bigint;
  readonly interestPaid: bigint;
  readonly newDrawn: bigint;
}

export function decodeCreditLineRepaid(log: unknown): CreditLineRepaidEvent {
  const a = requireEvent("CreditLineManager", "Repaid", log);
  return Object.freeze({
    lineId: asBytes32(a, "lineId"),
    principalPaid: asBigInt(a, "principalPaid"),
    interestPaid: asBigInt(a, "interestPaid"),
    newDrawn: asBigInt(a, "newDrawn"),
  });
}

// ---------------------------------------------------------------------------
// GuaranteeRegistry
// ---------------------------------------------------------------------------

const GUARANTEE_TYPE_VALUES: readonly GuaranteeType[] = [
  GuaranteeType.Performance,
  GuaranteeType.Payment,
  GuaranteeType.BidBond,
  GuaranteeType.AdvancePayment,
  GuaranteeType.Standby,
];

export interface GuaranteeIssuedEvent {
  readonly guaranteeId: Bytes32;
  readonly gType: GuaranteeType;
  readonly guarantor: Address;
  readonly beneficiary: Address;
  readonly principal: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly expiry: bigint;
}

export function decodeGuaranteeIssued(log: unknown): GuaranteeIssuedEvent {
  const a = requireEvent("GuaranteeRegistry", "Issued", log);
  const gTypeRaw = asNumber(a, "gType");
  if (!GUARANTEE_TYPE_VALUES.includes(gTypeRaw as GuaranteeType)) {
    throw new ValidationError('Field "gType" is not a valid GuaranteeType', {
      value: gTypeRaw,
    });
  }
  return Object.freeze({
    guaranteeId: asBytes32(a, "guaranteeId"),
    gType: gTypeRaw as GuaranteeType,
    guarantor: asAddress(a, "guarantor"),
    beneficiary: asAddress(a, "beneficiary"),
    principal: asAddress(a, "principal"),
    token: asAddress(a, "token"),
    amount: asBigInt(a, "amount"),
    expiry: asBigInt(a, "expiry"),
  });
}
