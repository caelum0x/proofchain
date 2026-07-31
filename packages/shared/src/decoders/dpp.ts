/**
 * `dpp` domain event decoders.
 *
 * viem log decoders for the key Digital Product Passport events. Each decoder
 * runs the raw log through the exact contract ABI (`decodeContractEvent`),
 * confirms the event name, then validates the decoded args with zod and
 * normalizes them into the immutable mirrors from `../types/dpp`. A structurally
 * malformed log throws `ValidationError` (via `decodeContractEvent`); a log for
 * a different event returns `null`; a matching-but-malformed payload throws
 * `ValidationError`. Nothing is silently coerced.
 */
import { z } from "zod";

import { type ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema, type Bytes32 } from "../types/core";
import {
  CarrierType,
  ComplianceVerdict,
  LifecycleEventType,
  PassportStatus,
  type CarrierRegisteredEvent,
  type CompositionSealedEvent,
  type DppComplianceEvaluatedEvent,
  type LifecycleRecordedEvent,
  type MaterialAddedEvent,
  type PassportIssuedEvent,
  type PassportStatusChangedEvent,
  type RecyclingCollectedEvent,
  type RecyclingRecoveredEvent,
  type RepairabilityScoreSetEvent,
} from "../types/dpp";
import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Reusable zod fragments mirroring how viem decodes ABI primitives.
// ---------------------------------------------------------------------------
const bytes32 = Bytes32Schema.transform((v) => v as Bytes32);
const address = AddressSchema;
const uint = z.bigint(); // uint64 / uint256
const smallUint = z.number().int().nonnegative(); // uint8 / uint16 / uint32

/**
 * Decode `log` against `contract`, require `eventName`, and validate the args
 * with `schema`. Returns `null` on an event-name miss; throws `ValidationError`
 * when the payload is malformed.
 */
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
// DigitalProductPassport
// ---------------------------------------------------------------------------
const PassportIssuedSchema = z.object({
  tokenId: uint,
  batchId: bytes32,
  manufacturer: address,
  gtin: bytes32,
});

export function decodePassportIssued(
  log: unknown,
): PassportIssuedEvent | null {
  return decodeArgs(
    "DigitalProductPassport",
    "PassportIssued",
    PassportIssuedSchema,
    log,
  );
}

const PassportStatusChangedSchema = z.object({
  tokenId: uint,
  status: z.nativeEnum(PassportStatus),
});

export function decodePassportStatusChanged(
  log: unknown,
): PassportStatusChangedEvent | null {
  return decodeArgs(
    "DigitalProductPassport",
    "StatusChanged",
    PassportStatusChangedSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// DPPLifecycleRegistry
// ---------------------------------------------------------------------------
const LifecycleRecordedSchema = z.object({
  tokenId: uint,
  index: uint,
  eventType: z.nativeEnum(LifecycleEventType),
  actor: address,
  dataHash: bytes32,
});

export function decodeLifecycleRecorded(
  log: unknown,
): LifecycleRecordedEvent | null {
  return decodeArgs(
    "DPPLifecycleRegistry",
    "LifecycleRecorded",
    LifecycleRecordedSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// MaterialComposition
// ---------------------------------------------------------------------------
const MaterialAddedSchema = z.object({
  tokenId: uint,
  materialCode: bytes32,
  fractionBps: smallUint,
  recycledContentBps: smallUint,
  hazardous: z.boolean(),
});

export function decodeMaterialAdded(log: unknown): MaterialAddedEvent | null {
  return decodeArgs(
    "MaterialComposition",
    "MaterialAdded",
    MaterialAddedSchema,
    log,
  );
}

const CompositionSealedSchema = z.object({
  tokenId: uint,
  totalRecycledContentBps: smallUint,
});

export function decodeCompositionSealed(
  log: unknown,
): CompositionSealedEvent | null {
  return decodeArgs(
    "MaterialComposition",
    "CompositionSealed",
    CompositionSealedSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// RepairabilityIndex
// ---------------------------------------------------------------------------
const RepairabilityScoreSetSchema = z.object({
  tokenId: uint,
  score: smallUint,
  assessor: address,
});

export function decodeRepairabilityScoreSet(
  log: unknown,
): RepairabilityScoreSetEvent | null {
  return decodeArgs(
    "RepairabilityIndex",
    "ScoreSet",
    RepairabilityScoreSetSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// RecyclingRegistry
// ---------------------------------------------------------------------------
const RecyclingCollectedSchema = z.object({
  recordId: bytes32,
  tokenId: uint,
  recycler: address,
  inputMassGrams: uint,
});

export function decodeRecyclingCollected(
  log: unknown,
): RecyclingCollectedEvent | null {
  return decodeArgs(
    "RecyclingRegistry",
    "Collected",
    RecyclingCollectedSchema,
    log,
  );
}

const RecyclingRecoveredSchema = z.object({
  recordId: bytes32,
  recoveredMassGrams: uint,
  recoveryRateBps: smallUint,
});

export function decodeRecyclingRecovered(
  log: unknown,
): RecyclingRecoveredEvent | null {
  return decodeArgs(
    "RecyclingRegistry",
    "Recovered",
    RecyclingRecoveredSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// DPPDataCarrier
// ---------------------------------------------------------------------------
const CarrierRegisteredSchema = z.object({
  carrierId: bytes32,
  tokenId: uint,
  carrierType: z.nativeEnum(CarrierType),
  uri: z.string(),
});

export function decodeCarrierRegistered(
  log: unknown,
): CarrierRegisteredEvent | null {
  return decodeArgs(
    "DPPDataCarrier",
    "CarrierRegistered",
    CarrierRegisteredSchema,
    log,
  );
}

// ---------------------------------------------------------------------------
// DPPComplianceOracle
// ---------------------------------------------------------------------------
const ComplianceEvaluatedSchema = z.object({
  tokenId: uint,
  regulationProfile: bytes32,
  score: smallUint,
  verdict: z.nativeEnum(ComplianceVerdict),
});

export function decodeDppComplianceEvaluated(
  log: unknown,
): DppComplianceEvaluatedEvent | null {
  return decodeArgs(
    "DPPComplianceOracle",
    "Evaluated",
    ComplianceEvaluatedSchema,
    log,
  );
}
