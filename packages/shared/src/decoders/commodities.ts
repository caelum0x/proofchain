/**
 * `commodities` domain event decoders.
 *
 * viem log decoders for the key commodity events (tokenization, harvest,
 * grading, storage receipts, price feed, custody vault). Each decoder runs the
 * raw log through the exact contract ABI (`decodeContractEvent`), confirms the
 * event name, then validates the decoded args with zod and normalizes them into
 * the immutable mirrors from `../types/commodities`. Malformed log structure or
 * payload throws `ValidationError`; an event-name miss returns `null`.
 */
import { z } from "zod";

import { type ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema, type Bytes32 } from "../types/core";
import {
  type CommodityBurnedEvent,
  type CommodityMintedEvent,
  type GradedEvent,
  type HarvestRegisteredEvent,
  type PriceUpdatedEvent,
  type ReceiptIssuedEvent,
  type VaultDepositedEvent,
  type VaultRedeemedEvent,
} from "../types/commodities";
import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Reusable zod fragments mirroring how viem decodes ABI primitives.
// ---------------------------------------------------------------------------
const bytes32 = Bytes32Schema.transform((v) => v as Bytes32);
const address = AddressSchema;
const uint = z.bigint(); // uint64 / uint256
const smallUint = z.number().int().nonnegative(); // uint8 / uint16 / uint32

function decodeArgs<S extends z.ZodTypeAny>(
  contract: ContractName,
  eventName: string,
  schema: S,
  log: unknown,
): z.infer<S> | null {
  const decoded = decodeContractEvent(contract, log);
  if (decoded === null || decoded.eventName !== eventName) return null;
  const result = schema.safeParse(decoded.args);
  if (!result.success) {
    throw new ValidationError(
      `Malformed ${contract}.${eventName} event args`,
      result.error.flatten(),
    );
  }
  return result.data as z.infer<S>;
}

// ---------------------------------------------------------------------------
// CommodityToken
// ---------------------------------------------------------------------------
const CommodityMintedSchema = z.object({
  to: address,
  amount: uint,
  receiptId: bytes32,
});

export function decodeCommodityMinted(
  log: unknown,
): CommodityMintedEvent | null {
  return decodeArgs("CommodityToken", "Minted", CommodityMintedSchema, log);
}

const CommodityBurnedSchema = z.object({
  from: address,
  amount: uint,
  receiptId: bytes32,
});

export function decodeCommodityBurned(
  log: unknown,
): CommodityBurnedEvent | null {
  return decodeArgs("CommodityToken", "Burned", CommodityBurnedSchema, log);
}

// ---------------------------------------------------------------------------
// HarvestRegistry
// ---------------------------------------------------------------------------
const HarvestRegisteredSchema = z.object({
  harvestId: bytes32,
  producer: address,
  crop: bytes32,
  quantityKg: uint,
  season: bytes32,
});

export function decodeHarvestRegistered(
  log: unknown,
): HarvestRegisteredEvent | null {
  return decodeArgs(
    "HarvestRegistry",
    "HarvestRegistered",
    HarvestRegisteredSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// GradingRegistry
// ---------------------------------------------------------------------------
const GradedSchema = z.object({
  gradingId: bytes32,
  lotId: bytes32,
  standard: bytes32,
  grade: bytes32,
  score: smallUint,
  grader: address,
});

export function decodeGraded(log: unknown): GradedEvent | null {
  return decodeArgs("GradingRegistry", "Graded", GradedSchema, log);
}

// ---------------------------------------------------------------------------
// StorageReceipt
// ---------------------------------------------------------------------------
const ReceiptIssuedSchema = z.object({
  receiptId: bytes32,
  warehouseId: bytes32,
  holder: address,
  commodityCode: bytes32,
  quantityKg: uint,
});

export function decodeReceiptIssued(log: unknown): ReceiptIssuedEvent | null {
  return decodeArgs("StorageReceipt", "ReceiptIssued", ReceiptIssuedSchema, log);
}

// ---------------------------------------------------------------------------
// PriceOracle
// ---------------------------------------------------------------------------
const PriceUpdatedSchema = z.object({
  symbol: bytes32,
  price: uint,
  updatedAt: uint,
});

export function decodePriceUpdated(log: unknown): PriceUpdatedEvent | null {
  return decodeArgs("PriceOracle", "PriceUpdated", PriceUpdatedSchema, log);
}

// ---------------------------------------------------------------------------
// CommodityVault
// ---------------------------------------------------------------------------
const VaultDepositedSchema = z.object({
  receiptId: bytes32,
  holder: address,
  commodityCode: bytes32,
  tokenAmount: uint,
});

export function decodeVaultDeposited(
  log: unknown,
): VaultDepositedEvent | null {
  return decodeArgs("CommodityVault", "Deposited", VaultDepositedSchema, log);
}

const VaultRedeemedSchema = z.object({
  receiptId: bytes32,
  holder: address,
  tokenAmount: uint,
});

export function decodeVaultRedeemed(log: unknown): VaultRedeemedEvent | null {
  return decodeArgs("CommodityVault", "Redeemed", VaultRedeemedSchema, log);
}
