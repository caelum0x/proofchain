/**
 * `dpp` domain types — EU Digital Product Passport (ESPR 2027) flagship module.
 *
 * Mirrors the on-chain structs, events, and status enums of the contracts in
 * `packages/contracts/src/dpp/` and their `interfaces/`:
 * `DigitalProductPassport`, `DPPLifecycleRegistry`, `MaterialComposition`,
 * `RepairabilityIndex`, `RecyclingRegistry`, `DPPDataCarrier`,
 * `DPPComplianceOracle`.
 *
 * Conventions (see `./core`): every field `readonly`; `bigint` for
 * uint256/uint64; `number` for uint8/uint16/uint32; branded `Address` /
 * `Bytes32` for on-chain identifiers. Numeric enum values MUST match the
 * Solidity `enum` order exactly — they are read straight off-chain.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// Enums (numeric values mirror the Solidity `enum` order exactly)
// ---------------------------------------------------------------------------

/** Mirror of `IDigitalProductPassport.PassportStatus`. */
export enum PassportStatus {
  None = 0,
  Active = 1,
  Suspended = 2,
  Recalled = 3,
  Retired = 4,
}

export const PASSPORT_STATUS_LABELS: Readonly<Record<PassportStatus, string>> =
  Object.freeze({
    [PassportStatus.None]: "None",
    [PassportStatus.Active]: "Active",
    [PassportStatus.Suspended]: "Suspended",
    [PassportStatus.Recalled]: "Recalled",
    [PassportStatus.Retired]: "Retired",
  });

/** Mirror of `IDPPLifecycleRegistry.EventType`. */
export enum LifecycleEventType {
  Manufactured = 0,
  QualityChecked = 1,
  Sold = 2,
  Transferred = 3,
  Serviced = 4,
  Repaired = 5,
  Refurbished = 6,
  Recycled = 7,
  Disposed = 8,
}

export const LIFECYCLE_EVENT_TYPE_LABELS: Readonly<
  Record<LifecycleEventType, string>
> = Object.freeze({
  [LifecycleEventType.Manufactured]: "Manufactured",
  [LifecycleEventType.QualityChecked]: "QualityChecked",
  [LifecycleEventType.Sold]: "Sold",
  [LifecycleEventType.Transferred]: "Transferred",
  [LifecycleEventType.Serviced]: "Serviced",
  [LifecycleEventType.Repaired]: "Repaired",
  [LifecycleEventType.Refurbished]: "Refurbished",
  [LifecycleEventType.Recycled]: "Recycled",
  [LifecycleEventType.Disposed]: "Disposed",
});

/** Mirror of `IRecyclingRegistry.RecycleState`. */
export enum RecycleState {
  None = 0,
  Collected = 1,
  Processing = 2,
  Recovered = 3,
  Disposed = 4,
}

export const RECYCLE_STATE_LABELS: Readonly<Record<RecycleState, string>> =
  Object.freeze({
    [RecycleState.None]: "None",
    [RecycleState.Collected]: "Collected",
    [RecycleState.Processing]: "Processing",
    [RecycleState.Recovered]: "Recovered",
    [RecycleState.Disposed]: "Disposed",
  });

/** Mirror of `IDPPDataCarrier.CarrierType`. */
export enum CarrierType {
  QRCode = 0,
  DataMatrix = 1,
  NFC = 2,
  RFID = 3,
  GS1DigitalLink = 4,
}

export const CARRIER_TYPE_LABELS: Readonly<Record<CarrierType, string>> =
  Object.freeze({
    [CarrierType.QRCode]: "QRCode",
    [CarrierType.DataMatrix]: "DataMatrix",
    [CarrierType.NFC]: "NFC",
    [CarrierType.RFID]: "RFID",
    [CarrierType.GS1DigitalLink]: "GS1DigitalLink",
  });

/** Mirror of `IDPPComplianceOracle.Verdict`. */
export enum ComplianceVerdict {
  Pending = 0,
  Compliant = 1,
  NonCompliant = 2,
  Conditional = 3,
}

export const COMPLIANCE_VERDICT_LABELS: Readonly<
  Record<ComplianceVerdict, string>
> = Object.freeze({
  [ComplianceVerdict.Pending]: "Pending",
  [ComplianceVerdict.Compliant]: "Compliant",
  [ComplianceVerdict.NonCompliant]: "NonCompliant",
  [ComplianceVerdict.Conditional]: "Conditional",
});

// ---------------------------------------------------------------------------
// On-chain struct mirrors (view-function return shapes)
// ---------------------------------------------------------------------------

/** Mirror of `IDigitalProductPassport.Passport`. */
export interface Passport {
  readonly tokenId: bigint;
  readonly batchId: Bytes32;
  readonly gtin: Bytes32;
  readonly manufacturer: Address;
  readonly dataURI: string;
  readonly status: PassportStatus;
  readonly issuedAt: bigint;
}

/** Mirror of `IDPPLifecycleRegistry.LifecycleEvent`. */
export interface LifecycleEvent {
  readonly tokenId: bigint;
  readonly eventType: LifecycleEventType;
  readonly actor: Address;
  readonly dataHash: Bytes32;
  readonly location: string;
  readonly timestamp: bigint;
}

/** Mirror of `IMaterialComposition.Material`. */
export interface Material {
  readonly materialCode: Bytes32;
  readonly fractionBps: number; // uint16
  readonly recycledContentBps: number; // uint16
  readonly hazardous: boolean;
}

/** Mirror of `IRepairabilityIndex.Criteria` (each sub-score 0..10000 bps). */
export interface RepairabilityCriteria {
  readonly documentation: number; // uint16
  readonly disassembly: number; // uint16
  readonly spareAvailability: number; // uint16
  readonly sparePricing: number; // uint16
  readonly softwareSupport: number; // uint16
}

/** Mirror of `IRepairabilityIndex.Weights` (each weight in bps, sum 10000). */
export interface RepairabilityWeights {
  readonly documentationW: number; // uint16
  readonly disassemblyW: number; // uint16
  readonly spareAvailabilityW: number; // uint16
  readonly sparePricingW: number; // uint16
  readonly softwareSupportW: number; // uint16
}

/** Mirror of `IRecyclingRegistry.RecycleRecord`. */
export interface RecycleRecord {
  readonly recordId: Bytes32;
  readonly tokenId: bigint;
  readonly recycler: Address;
  readonly inputMassGrams: bigint;
  readonly recoveredMassGrams: bigint;
  readonly facilityId: Bytes32;
  readonly state: RecycleState;
  readonly updatedAt: bigint;
}

/** Mirror of `IDPPDataCarrier.Carrier`. */
export interface Carrier {
  readonly carrierId: Bytes32;
  readonly tokenId: bigint;
  readonly carrierType: CarrierType;
  readonly uri: string;
  readonly active: boolean;
  readonly registeredAt: bigint;
}

/** Mirror of `IDPPComplianceOracle.ComplianceReport`. */
export interface ComplianceReport {
  readonly tokenId: bigint;
  readonly regulationProfile: Bytes32;
  readonly score: number; // uint16 bps
  readonly satisfiedFlags: number; // uint32 bitfield
  readonly requiredFlags: number; // uint32 bitfield
  readonly verdict: ComplianceVerdict;
  readonly evidenceHash: Bytes32;
  readonly evaluatedAt: bigint;
}

// ---------------------------------------------------------------------------
// Event payload mirrors (decoded by `../decoders/dpp`)
// ---------------------------------------------------------------------------

/** Payload of `DigitalProductPassport.PassportIssued`. */
export interface PassportIssuedEvent {
  readonly tokenId: bigint;
  readonly batchId: Bytes32;
  readonly manufacturer: Address;
  readonly gtin: Bytes32;
}

/** Payload of `DigitalProductPassport.StatusChanged`. */
export interface PassportStatusChangedEvent {
  readonly tokenId: bigint;
  readonly status: PassportStatus;
}

/** Payload of `DPPLifecycleRegistry.LifecycleRecorded`. */
export interface LifecycleRecordedEvent {
  readonly tokenId: bigint;
  readonly index: bigint;
  readonly eventType: LifecycleEventType;
  readonly actor: Address;
  readonly dataHash: Bytes32;
}

/** Payload of `MaterialComposition.MaterialAdded`. */
export interface MaterialAddedEvent {
  readonly tokenId: bigint;
  readonly materialCode: Bytes32;
  readonly fractionBps: number;
  readonly recycledContentBps: number;
  readonly hazardous: boolean;
}

/** Payload of `MaterialComposition.CompositionSealed`. */
export interface CompositionSealedEvent {
  readonly tokenId: bigint;
  readonly totalRecycledContentBps: number;
}

/** Payload of `RepairabilityIndex.ScoreSet`. */
export interface RepairabilityScoreSetEvent {
  readonly tokenId: bigint;
  readonly score: number;
  readonly assessor: Address;
}

/** Payload of `RecyclingRegistry.Collected`. */
export interface RecyclingCollectedEvent {
  readonly recordId: Bytes32;
  readonly tokenId: bigint;
  readonly recycler: Address;
  readonly inputMassGrams: bigint;
}

/** Payload of `RecyclingRegistry.Recovered`. */
export interface RecyclingRecoveredEvent {
  readonly recordId: Bytes32;
  readonly recoveredMassGrams: bigint;
  readonly recoveryRateBps: number;
}

/** Payload of `DPPDataCarrier.CarrierRegistered`. */
export interface CarrierRegisteredEvent {
  readonly carrierId: Bytes32;
  readonly tokenId: bigint;
  readonly carrierType: CarrierType;
  readonly uri: string;
}

/** Payload of `DPPComplianceOracle.Evaluated`. */
export interface DppComplianceEvaluatedEvent {
  readonly tokenId: bigint;
  readonly regulationProfile: Bytes32;
  readonly score: number;
  readonly verdict: ComplianceVerdict;
}

// ---------------------------------------------------------------------------
// Request / response DTOs (consumed by api + web)
// ---------------------------------------------------------------------------

/** Filter parameters for a passport listing endpoint. */
export interface PassportListQuery {
  readonly manufacturer?: Address;
  readonly batchId?: Bytes32;
  readonly status?: PassportStatus;
  readonly limit?: number;
  readonly cursor?: string;
}

/** Denormalized passport row for list/detail views. */
export interface PassportSummary {
  readonly tokenId: bigint;
  readonly batchId: Bytes32;
  readonly gtin: Bytes32;
  readonly manufacturer: Address;
  readonly status: PassportStatus;
  readonly statusLabel: string;
  readonly issuedAt: bigint;
  readonly recycledContentBps: number | null;
  readonly repairabilityScore: number | null;
  readonly hasHazardous: boolean;
}
