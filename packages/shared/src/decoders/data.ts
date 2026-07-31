/**
 * `data` domain event decoders.
 *
 * Strongly-typed viem event-log decoders for the key events emitted by the
 * `src/data/` contracts. Each decoder resolves the raw log against the specific
 * contract ABI (via {@link decodeContractEvent}), then validates and normalizes
 * the args with zod into an immutable, branded event object.
 *
 * A decoder returns `null` for a non-matching log (an expected miss) and throws
 * {@link ValidationError} when the log matches the target event signature but
 * carries a malformed payload — it never silently coerces.
 *
 * Re-exported by `../decoders/index.ts`.
 */
import { z } from "zod";

import type { ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema, type Bytes32 } from "../types";
import {
  DataListingState,
  InspectionOutcome,
  LabTestResult,
  SensorType,
} from "../types/data";

import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Shared field schemas + decoder factory
// ---------------------------------------------------------------------------

const bytes32 = Bytes32Schema.transform((v): Bytes32 => v as Bytes32);
const address = AddressSchema;
/** uint64 / uint256 decode to `bigint` under viem. */
const big = z.bigint();
/** uint8 decodes to `number` under viem. */
const u8 = z.number().int().min(0).max(255);
/** uint16 decodes to `number` under viem. */
const u16 = z.number().int().min(0).max(65_535);
/** uint32 decodes to `number` under viem. */
const u32 = z.number().int().min(0).max(4_294_967_295);

/**
 * Build a decoder for one `(contract, event)` pair. Returns the validated,
 * immutable args, `null` for a non-matching log, and throws for a malformed
 * payload of the target event.
 */
function makeEventDecoder<S extends z.ZodTypeAny>(
  contract: ContractName,
  eventName: string,
  schema: S,
): (log: unknown) => z.infer<S> | null {
  return (log: unknown): z.infer<S> | null => {
    const decoded = decodeContractEvent(contract, log);
    if (decoded === null || decoded.eventName !== eventName) return null;
    const parsed = schema.safeParse(decoded.args);
    if (!parsed.success) {
      throw new ValidationError(
        `Malformed ${contract}.${eventName} event payload`,
        parsed.error.flatten(),
      );
    }
    return Object.freeze(parsed.data as Record<string, unknown>) as z.infer<S>;
  };
}

// ---------------------------------------------------------------------------
// IoTSensorRegistry
// ---------------------------------------------------------------------------

const SensorRegisteredSchema = z.object({
  sensorId: bytes32,
  owner: address,
  deviceKey: address,
  sensorType: z.nativeEnum(SensorType),
});
export type SensorRegisteredEvent = z.infer<typeof SensorRegisteredSchema>;
export const decodeSensorRegistered = makeEventDecoder(
  "IoTSensorRegistry",
  "SensorRegistered",
  SensorRegisteredSchema,
);

const SensorCommissionedSchema = z.object({
  sensorId: bytes32,
  assetId: bytes32,
});
export type SensorCommissionedEvent = z.infer<typeof SensorCommissionedSchema>;
export const decodeSensorCommissioned = makeEventDecoder(
  "IoTSensorRegistry",
  "SensorCommissioned",
  SensorCommissionedSchema,
);

const DeviceKeyRotatedSchema = z.object({
  sensorId: bytes32,
  oldKey: address,
  newKey: address,
});
export type DeviceKeyRotatedEvent = z.infer<typeof DeviceKeyRotatedSchema>;
export const decodeDeviceKeyRotated = makeEventDecoder(
  "IoTSensorRegistry",
  "DeviceKeyRotated",
  DeviceKeyRotatedSchema,
);

const SensorCompromisedSchema = z.object({
  sensorId: bytes32,
  reason: bytes32,
});
export type SensorCompromisedEvent = z.infer<typeof SensorCompromisedSchema>;
export const decodeSensorCompromised = makeEventDecoder(
  "IoTSensorRegistry",
  "SensorCompromised",
  SensorCompromisedSchema,
);

// ---------------------------------------------------------------------------
// QualityInspection
// ---------------------------------------------------------------------------

const InspectionOpenedSchema = z.object({
  inspectionId: bytes32,
  lotId: bytes32,
  inspector: address,
  standard: bytes32,
});
export type InspectionOpenedEvent = z.infer<typeof InspectionOpenedSchema>;
export const decodeInspectionOpened = makeEventDecoder(
  "QualityInspection",
  "InspectionOpened",
  InspectionOpenedSchema,
);

const InspectionRecordedSchema = z.object({
  inspectionId: bytes32,
  outcome: z.nativeEnum(InspectionOutcome),
  defectPpm: u16,
  evidenceHash: bytes32,
});
export type InspectionRecordedEvent = z.infer<typeof InspectionRecordedSchema>;
export const decodeInspectionRecorded = makeEventDecoder(
  "QualityInspection",
  "InspectionRecorded",
  InspectionRecordedSchema,
);

const InspectionRevokedSchema = z.object({
  inspectionId: bytes32,
  reason: bytes32,
});
export type InspectionRevokedEvent = z.infer<typeof InspectionRevokedSchema>;
export const decodeInspectionRevoked = makeEventDecoder(
  "QualityInspection",
  "InspectionRevoked",
  InspectionRevokedSchema,
);

// ---------------------------------------------------------------------------
// LabTestAttestation
// ---------------------------------------------------------------------------

const LabTestAttestedSchema = z.object({
  testId: bytes32,
  lotId: bytes32,
  lab: address,
  analyte: bytes32,
  result: z.nativeEnum(LabTestResult),
});
export type LabTestAttestedEvent = z.infer<typeof LabTestAttestedSchema>;
export const decodeLabTestAttested = makeEventDecoder(
  "LabTestAttestation",
  "LabTestAttested",
  LabTestAttestedSchema,
);

const LabTestRevokedSchema = z.object({
  testId: bytes32,
  reason: bytes32,
});
export type LabTestRevokedEvent = z.infer<typeof LabTestRevokedSchema>;
export const decodeLabTestRevoked = makeEventDecoder(
  "LabTestAttestation",
  "LabTestRevoked",
  LabTestRevokedSchema,
);

// ---------------------------------------------------------------------------
// OracleAggregator
// ---------------------------------------------------------------------------

const FeedConfiguredSchema = z.object({
  feedId: bytes32,
  minQuorum: u8,
});
export type FeedConfiguredEvent = z.infer<typeof FeedConfiguredSchema>;
export const decodeFeedConfigured = makeEventDecoder(
  "OracleAggregator",
  "FeedConfigured",
  FeedConfiguredSchema,
);

const OracleSubmittedSchema = z.object({
  feedId: bytes32,
  roundId: big,
  reporter: address,
  value: big,
});
export type OracleSubmittedEvent = z.infer<typeof OracleSubmittedSchema>;
export const decodeOracleSubmitted = makeEventDecoder(
  "OracleAggregator",
  "Submitted",
  OracleSubmittedSchema,
);

const RoundFinalizedSchema = z.object({
  feedId: bytes32,
  roundId: big,
  answer: big,
  submissionCount: u8,
});
export type RoundFinalizedEvent = z.infer<typeof RoundFinalizedSchema>;
export const decodeRoundFinalized = makeEventDecoder(
  "OracleAggregator",
  "RoundFinalized",
  RoundFinalizedSchema,
);

// ---------------------------------------------------------------------------
// DataMarketplace
// ---------------------------------------------------------------------------

const DatasetListedSchema = z.object({
  listingId: bytes32,
  provider: address,
  token: address,
  price: big,
  accessDays: u32,
});
export type DatasetListedEvent = z.infer<typeof DatasetListedSchema>;
export const decodeDatasetListed = makeEventDecoder(
  "DataMarketplace",
  "Listed",
  DatasetListedSchema,
);

const AccessPurchasedSchema = z.object({
  listingId: bytes32,
  buyer: address,
  price: big,
  expiresAt: big,
});
export type AccessPurchasedEvent = z.infer<typeof AccessPurchasedSchema>;
export const decodeAccessPurchased = makeEventDecoder(
  "DataMarketplace",
  "AccessPurchased",
  AccessPurchasedSchema,
);

const DataListingStateChangedSchema = z.object({
  listingId: bytes32,
  state: z.nativeEnum(DataListingState),
});
export type DataListingStateChangedEvent = z.infer<
  typeof DataListingStateChangedSchema
>;
export const decodeDataListingStateChanged = makeEventDecoder(
  "DataMarketplace",
  "ListingStateChanged",
  DataListingStateChangedSchema,
);

const DataPriceUpdatedSchema = z.object({
  listingId: bytes32,
  price: big,
});
export type DataPriceUpdatedEvent = z.infer<typeof DataPriceUpdatedSchema>;
export const decodeDataPriceUpdated = makeEventDecoder(
  "DataMarketplace",
  "PriceUpdated",
  DataPriceUpdatedSchema,
);
