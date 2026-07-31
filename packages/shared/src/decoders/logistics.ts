/**
 * `logistics` domain event decoders.
 *
 * viem log decoders for the key logistics events (freight, cold-chain, bonded
 * warehousing, fleet, route, container, last-mile). Each decoder runs the raw
 * log through the exact contract ABI (`decodeContractEvent`), confirms the event
 * name, then validates the decoded args with zod and normalizes them into the
 * immutable mirrors from `../types/logistics`. Malformed log structure or
 * payload throws `ValidationError`; an event-name miss returns `null`.
 */
import { z } from "zod";

import { type ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema, type Bytes32 } from "../types/core";
import {
  AssetType,
  FreightMode,
  type BondedLotDepositedEvent,
  type ColdChainBreachedEvent,
  type ColdChainReadingRecordedEvent,
  type ContainerSealedEvent,
  type CustomsBondDrawnEvent,
  type FleetAssetRegisteredEvent,
  type FreightConfirmedEvent,
  type FreightRequestedEvent,
  type LastMileDeliveredEvent,
  type WaypointReachedEvent,
} from "../types/logistics";
import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Reusable zod fragments mirroring how viem decodes ABI primitives.
// ---------------------------------------------------------------------------
const bytes32 = Bytes32Schema.transform((v) => v as Bytes32);
const address = AddressSchema;
const uint = z.bigint(); // uint64 / uint256
const int = z.bigint(); // int256 (signed; e.g. cold-chain temperature)
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
// FreightBooking
// ---------------------------------------------------------------------------
const FreightRequestedSchema = z.object({
  bookingId: bytes32,
  batchId: bytes32,
  shipper: address,
  carrier: address,
  mode: z.nativeEnum(FreightMode),
});

export function decodeFreightRequested(
  log: unknown,
): FreightRequestedEvent | null {
  return decodeArgs("FreightBooking", "Requested", FreightRequestedSchema, log);
}

const FreightConfirmedSchema = z.object({
  bookingId: bytes32,
  freightAmount: uint,
  etd: uint,
  eta: uint,
});

export function decodeFreightConfirmed(
  log: unknown,
): FreightConfirmedEvent | null {
  return decodeArgs("FreightBooking", "Confirmed", FreightConfirmedSchema, log);
}

// ---------------------------------------------------------------------------
// ColdChainMonitor
// ---------------------------------------------------------------------------
const ColdChainReadingRecordedSchema = z.object({
  batchId: bytes32,
  index: uint,
  temp: int,
  humidityBps: smallUint,
  breach: z.boolean(),
});

export function decodeColdChainReadingRecorded(
  log: unknown,
): ColdChainReadingRecordedEvent | null {
  return decodeArgs(
    "ColdChainMonitor",
    "ReadingRecorded",
    ColdChainReadingRecordedSchema,
    log,
  );
}

const ColdChainBreachedSchema = z.object({
  batchId: bytes32,
  temp: int,
  humidityBps: smallUint,
  breachCount: smallUint,
});

export function decodeColdChainBreached(
  log: unknown,
): ColdChainBreachedEvent | null {
  return decodeArgs(
    "ColdChainMonitor",
    "Breached",
    ColdChainBreachedSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// BondedWarehouse
// ---------------------------------------------------------------------------
const BondedLotDepositedSchema = z.object({
  lotId: bytes32,
  warehouseId: bytes32,
  batchId: bytes32,
  owner: address,
  quantity: uint,
});

export function decodeBondedLotDeposited(
  log: unknown,
): BondedLotDepositedEvent | null {
  return decodeArgs(
    "BondedWarehouse",
    "Deposited",
    BondedLotDepositedSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// FleetRegistry
// ---------------------------------------------------------------------------
const FleetAssetRegisteredSchema = z.object({
  assetId: bytes32,
  carrier: address,
  assetType: z.nativeEnum(AssetType),
  capacityKg: uint,
});

export function decodeFleetAssetRegistered(
  log: unknown,
): FleetAssetRegisteredEvent | null {
  return decodeArgs(
    "FleetRegistry",
    "AssetRegistered",
    FleetAssetRegisteredSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// RouteAttestation
// ---------------------------------------------------------------------------
const WaypointReachedSchema = z.object({
  routeId: bytes32,
  index: smallUint, // uint16 indexed
  geohash: bytes32,
  reachedAt: uint,
});

export function decodeWaypointReached(
  log: unknown,
): WaypointReachedEvent | null {
  return decodeArgs(
    "RouteAttestation",
    "WaypointReached",
    WaypointReachedSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// CustomsBonded
// ---------------------------------------------------------------------------
const CustomsBondDrawnSchema = z.object({
  bondId: bytes32,
  declarationId: bytes32,
  amount: uint,
  drawnTotal: uint,
});

export function decodeCustomsBondDrawn(
  log: unknown,
): CustomsBondDrawnEvent | null {
  return decodeArgs("CustomsBonded", "BondDrawn", CustomsBondDrawnSchema, log);
}

// ---------------------------------------------------------------------------
// ContainerRegistry
// ---------------------------------------------------------------------------
const ContainerSealedSchema = z.object({
  containerId: bytes32,
  batchId: bytes32,
  sealId: bytes32,
});

export function decodeContainerSealed(
  log: unknown,
): ContainerSealedEvent | null {
  return decodeArgs(
    "ContainerRegistry",
    "ContainerSealed",
    ContainerSealedSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// LastMileProofOfDelivery
// ---------------------------------------------------------------------------
const LastMileDeliveredSchema = z.object({
  deliveryId: bytes32,
  geohash: bytes32,
  proofHash: bytes32,
  deliveredAt: uint,
});

export function decodeLastMileDelivered(
  log: unknown,
): LastMileDeliveredEvent | null {
  return decodeArgs(
    "LastMileProofOfDelivery",
    "Delivered",
    LastMileDeliveredSchema,
    log,
  );
}
