/**
 * `data` domain types.
 *
 * TypeScript mirrors of the on-chain structs, enums and status values used by
 * the `src/data/` contracts (IoTSensorRegistry, QualityInspection,
 * LabTestAttestation, OracleAggregator, DataMarketplace) plus the request DTOs
 * the api/web use to drive their write paths.
 *
 * Numeric enum values MUST match the Solidity `enum` declaration order exactly.
 * Every field is `readonly`; `bigint` mirrors uint256/uint64/int256, `number`
 * mirrors uint8/uint16/uint32.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// IoTSensorRegistry (trusted device registry for oracle feeds)
// ---------------------------------------------------------------------------

/** Mirror of `IIoTSensorRegistry.SensorType`. */
export enum SensorType {
  Temperature = 0,
  Humidity = 1,
  Gps = 2,
  Shock = 3,
  EnergyMeter = 4,
  FlowMeter = 5,
  Other = 6,
}

export const SENSOR_TYPE_LABELS: Readonly<Record<SensorType, string>> =
  Object.freeze({
    [SensorType.Temperature]: "Temperature",
    [SensorType.Humidity]: "Humidity",
    [SensorType.Gps]: "Gps",
    [SensorType.Shock]: "Shock",
    [SensorType.EnergyMeter]: "EnergyMeter",
    [SensorType.FlowMeter]: "FlowMeter",
    [SensorType.Other]: "Other",
  });

/** Mirror of `IIoTSensorRegistry.SensorStatus`. */
export enum SensorStatus {
  None = 0,
  Registered = 1,
  Commissioned = 2,
  Decommissioned = 3,
  Compromised = 4,
}

export const SENSOR_STATUS_LABELS: Readonly<Record<SensorStatus, string>> =
  Object.freeze({
    [SensorStatus.None]: "None",
    [SensorStatus.Registered]: "Registered",
    [SensorStatus.Commissioned]: "Commissioned",
    [SensorStatus.Decommissioned]: "Decommissioned",
    [SensorStatus.Compromised]: "Compromised",
  });

/** Mirror of `IIoTSensorRegistry.Sensor`. */
export interface Sensor {
  readonly sensorId: Bytes32;
  readonly owner: Address;
  readonly deviceKey: Address;
  readonly sensorType: SensorType;
  readonly assetId: Bytes32;
  readonly metadataHash: Bytes32;
  readonly registeredAt: bigint; // uint64
  readonly status: SensorStatus;
}

// ---------------------------------------------------------------------------
// QualityInspection (physical quality inspections of lots)
// ---------------------------------------------------------------------------

/** Mirror of `IQualityInspection.Outcome`. */
export enum InspectionOutcome {
  Pending = 0,
  Passed = 1,
  Failed = 2,
  Conditional = 3,
}

export const INSPECTION_OUTCOME_LABELS: Readonly<
  Record<InspectionOutcome, string>
> = Object.freeze({
  [InspectionOutcome.Pending]: "Pending",
  [InspectionOutcome.Passed]: "Passed",
  [InspectionOutcome.Failed]: "Failed",
  [InspectionOutcome.Conditional]: "Conditional",
});

/** Mirror of `IQualityInspection.Inspection`. */
export interface QualityInspectionData {
  readonly inspectionId: Bytes32;
  readonly lotId: Bytes32;
  readonly inspector: Address;
  readonly standard: Bytes32;
  readonly outcome: InspectionOutcome;
  readonly defectPpm: number; // uint16
  readonly evidenceHash: Bytes32;
  readonly inspectedAt: bigint; // uint64
  readonly revoked: boolean;
}

// ---------------------------------------------------------------------------
// LabTestAttestation (accredited certificate-of-analysis)
// ---------------------------------------------------------------------------

/** Mirror of `ILabTestAttestation.Result`. */
export enum LabTestResult {
  Pending = 0,
  Pass = 1,
  Fail = 2,
  Inconclusive = 3,
}

export const LAB_TEST_RESULT_LABELS: Readonly<Record<LabTestResult, string>> =
  Object.freeze({
    [LabTestResult.Pending]: "Pending",
    [LabTestResult.Pass]: "Pass",
    [LabTestResult.Fail]: "Fail",
    [LabTestResult.Inconclusive]: "Inconclusive",
  });

/** Mirror of `ILabTestAttestation.LabTest`. */
export interface LabTest {
  readonly testId: Bytes32;
  readonly lotId: Bytes32;
  readonly sampleId: Bytes32;
  readonly lab: Address;
  readonly analyte: Bytes32;
  readonly method: Bytes32;
  readonly measuredValue: bigint; // int256
  readonly limitValue: bigint; // int256
  readonly decimals: number; // uint8
  readonly result: LabTestResult;
  readonly reportHash: Bytes32;
  readonly testedAt: bigint; // uint64
  readonly revoked: boolean;
}

// ---------------------------------------------------------------------------
// OracleAggregator (quorum median oracle feeds)
// ---------------------------------------------------------------------------

/** Mirror of `IOracleAggregator.RoundState`. */
export enum OracleRoundState {
  None = 0,
  Collecting = 1,
  Finalized = 2,
}

export const ORACLE_ROUND_STATE_LABELS: Readonly<
  Record<OracleRoundState, string>
> = Object.freeze({
  [OracleRoundState.None]: "None",
  [OracleRoundState.Collecting]: "Collecting",
  [OracleRoundState.Finalized]: "Finalized",
});

/** Mirror of `IOracleAggregator.FeedConfig`. */
export interface OracleFeedConfig {
  readonly feedId: Bytes32;
  readonly minQuorum: number; // uint8
  readonly reporterCount: number; // uint8
  readonly roundId: bigint; // uint64
  readonly active: boolean;
}

/** Mirror of `IOracleAggregator.Round`. */
export interface OracleRound {
  readonly roundId: bigint; // uint64
  readonly answer: bigint;
  readonly submissionCount: number; // uint8
  readonly finalizedAt: bigint; // uint64
  readonly state: OracleRoundState;
}

// ---------------------------------------------------------------------------
// DataMarketplace (paid, time-boxed dataset access)
// ---------------------------------------------------------------------------

/** Mirror of `IDataMarketplace.ListingState`. */
export enum DataListingState {
  None = 0,
  Active = 1,
  Paused = 2,
  Delisted = 3,
}

export const DATA_LISTING_STATE_LABELS: Readonly<
  Record<DataListingState, string>
> = Object.freeze({
  [DataListingState.None]: "None",
  [DataListingState.Active]: "Active",
  [DataListingState.Paused]: "Paused",
  [DataListingState.Delisted]: "Delisted",
});

/** Mirror of `IDataMarketplace.Listing`. */
export interface DataListing {
  readonly listingId: Bytes32;
  readonly provider: Address;
  readonly token: Address;
  readonly price: bigint;
  readonly accessDays: number; // uint32
  readonly contentHash: Bytes32;
  readonly uri: string;
  readonly state: DataListingState;
}

/** Mirror of `IDataMarketplace.Access`. */
export interface DataAccess {
  readonly listingId: Bytes32;
  readonly buyer: Address;
  readonly grantedAt: bigint; // uint64
  readonly expiresAt: bigint; // uint64
}

// ---------------------------------------------------------------------------
// Request DTOs (api/web write paths)
// ---------------------------------------------------------------------------

export interface RegisterSensorInput {
  readonly sensorId: Bytes32;
  readonly owner: Address;
  readonly deviceKey: Address;
  readonly sensorType: SensorType;
  readonly metadataHash: Bytes32;
}

export interface OpenInspectionInput {
  readonly inspectionId: Bytes32;
  readonly lotId: Bytes32;
  readonly standard: Bytes32;
}

export interface RecordInspectionOutcomeInput {
  readonly inspectionId: Bytes32;
  readonly outcome: InspectionOutcome;
  readonly defectPpm: number;
  readonly evidenceHash: Bytes32;
}

export interface AttestLabTestInput {
  readonly testId: Bytes32;
  readonly lotId: Bytes32;
  readonly sampleId: Bytes32;
  readonly analyte: Bytes32;
  readonly method: Bytes32;
  readonly measuredValue: bigint;
  readonly limitValue: bigint;
  readonly decimals: number;
  readonly result: LabTestResult;
  readonly reportHash: Bytes32;
}

export interface ConfigureFeedInput {
  readonly feedId: Bytes32;
  readonly minQuorum: number;
}

export interface ListDatasetInput {
  readonly listingId: Bytes32;
  readonly token: Address;
  readonly price: bigint;
  readonly accessDays: number;
  readonly contentHash: Bytes32;
  readonly uri: string;
}
