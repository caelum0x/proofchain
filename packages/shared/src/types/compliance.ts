/**
 * `compliance` domain types.
 *
 * TypeScript mirrors of the on-chain structs, enums and status values declared
 * by the `src/compliance/*` contracts (SanctionsScreening, AMLRegistry,
 * TradeComplianceEngine, CertificateOfOrigin, PhytosanitaryCertificate,
 * HalalCertification, ProductRecallRegistry, ExportLicenseRegistry,
 * DutyAndTariffCalculator, CustomsDeclaration), plus the request/response DTOs
 * the api/web consume.
 *
 * Conventions (see `./core.ts`): every field is `readonly`; `bigint` for
 * uint256/uint64, `number` for uint8/uint16/uint32; branded `Address` /
 * `Bytes32` / `Hex` come from `./core`. Numeric enum values MUST match the
 * Solidity `enum` declaration order exactly — they are read straight off-chain.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// SanctionsScreening — mirror of `ISanctionsScreening`
// ---------------------------------------------------------------------------

/** Mirror of `ISanctionsScreening.ListSource`. */
export enum SanctionListSource {
  Unknown = 0,
  OFAC = 1,
  EU = 2,
  UN = 3,
  UK = 4,
  Other = 5,
}

export const SANCTION_LIST_SOURCE_LABELS: Readonly<
  Record<SanctionListSource, string>
> = Object.freeze({
  [SanctionListSource.Unknown]: "Unknown",
  [SanctionListSource.OFAC]: "OFAC",
  [SanctionListSource.EU]: "EU",
  [SanctionListSource.UN]: "UN",
  [SanctionListSource.UK]: "UK",
  [SanctionListSource.Other]: "Other",
});

/** Mirror of `ISanctionsScreening.SanctionEntry`. */
export interface SanctionEntry {
  readonly blocked: boolean;
  readonly source: SanctionListSource;
  readonly reasonHash: Bytes32;
  readonly addedAt: bigint; // uint64
  readonly clearedAt: bigint; // uint64
}

// ---------------------------------------------------------------------------
// AMLRegistry — mirror of `IAMLRegistry`
// ---------------------------------------------------------------------------

/** Mirror of `IAMLRegistry.RiskRating`. */
export enum AmlRiskRating {
  Unrated = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  Prohibited = 4,
}

export const AML_RISK_RATING_LABELS: Readonly<Record<AmlRiskRating, string>> =
  Object.freeze({
    [AmlRiskRating.Unrated]: "Unrated",
    [AmlRiskRating.Low]: "Low",
    [AmlRiskRating.Medium]: "Medium",
    [AmlRiskRating.High]: "High",
    [AmlRiskRating.Prohibited]: "Prohibited",
  });

/** Mirror of `IAMLRegistry.RiskProfile`. */
export interface AmlRiskProfile {
  readonly rating: AmlRiskRating;
  readonly updatedAt: bigint; // uint64
  readonly evidenceHash: Bytes32;
  readonly openSARs: number; // uint32
}

// ---------------------------------------------------------------------------
// TradeComplianceEngine — mirror of `ITradeComplianceEngine`
// ---------------------------------------------------------------------------

/** Mirror of `ITradeComplianceEngine.Decision`. */
export enum ComplianceDecision {
  Pending = 0,
  Cleared = 1,
  Blocked = 2,
  NeedsReview = 3,
}

export const COMPLIANCE_DECISION_LABELS: Readonly<
  Record<ComplianceDecision, string>
> = Object.freeze({
  [ComplianceDecision.Pending]: "Pending",
  [ComplianceDecision.Cleared]: "Cleared",
  [ComplianceDecision.Blocked]: "Blocked",
  [ComplianceDecision.NeedsReview]: "Needs Review",
});

/**
 * Individual compliance-check flags. The ordinal is the bit position used in
 * the `failedFlags` / `requiredFlags` bitmask on `ITradeComplianceEngine`
 * (1<<0 sanctions .. 1<<4 customs).
 */
export enum ComplianceCheckFlag {
  Sanctions = 0,
  Aml = 1,
  License = 2,
  Certificate = 3,
  Customs = 4,
}

/** All check flags in bit-position order. */
export const COMPLIANCE_CHECK_FLAGS: readonly ComplianceCheckFlag[] =
  Object.freeze([
    ComplianceCheckFlag.Sanctions,
    ComplianceCheckFlag.Aml,
    ComplianceCheckFlag.License,
    ComplianceCheckFlag.Certificate,
    ComplianceCheckFlag.Customs,
  ]);

export const COMPLIANCE_CHECK_FLAG_LABELS: Readonly<
  Record<ComplianceCheckFlag, string>
> = Object.freeze({
  [ComplianceCheckFlag.Sanctions]: "Sanctions",
  [ComplianceCheckFlag.Aml]: "AML",
  [ComplianceCheckFlag.License]: "License",
  [ComplianceCheckFlag.Certificate]: "Certificate",
  [ComplianceCheckFlag.Customs]: "Customs",
});

/** Mirror of `ITradeComplianceEngine.Check`. */
export interface ComplianceCheck {
  readonly batchId: Bytes32;
  readonly exporter: Address;
  readonly importer: Address;
  readonly destinationCountry: Bytes32;
  readonly decision: ComplianceDecision;
  readonly failedFlags: number; // uint32 bitmask
  readonly evaluatedAt: bigint; // uint64
}

// ---------------------------------------------------------------------------
// CertificateOfOrigin — mirror of `ICertificateOfOrigin`
// ---------------------------------------------------------------------------

/** Mirror of `ICertificateOfOrigin.OriginType`. */
export enum OriginType {
  NonPreferential = 0,
  Preferential = 1,
}

export const ORIGIN_TYPE_LABELS: Readonly<Record<OriginType, string>> =
  Object.freeze({
    [OriginType.NonPreferential]: "Non-Preferential",
    [OriginType.Preferential]: "Preferential",
  });

/** Mirror of `ICertificateOfOrigin.Certificate`. */
export interface CertificateOfOrigin {
  readonly certId: Bytes32;
  readonly batchId: Bytes32;
  readonly originCountry: Bytes32;
  readonly originType: OriginType;
  readonly issuer: Address;
  readonly exporter: Address;
  readonly documentHash: Bytes32;
  readonly issuedAt: bigint; // uint64
  readonly expiry: bigint; // uint64
  readonly revoked: boolean;
}

// ---------------------------------------------------------------------------
// PhytosanitaryCertificate — mirror of `IPhytosanitaryCertificate`
// ---------------------------------------------------------------------------

/** Mirror of `IPhytosanitaryCertificate.TreatmentType`. */
export enum PhytoTreatmentType {
  None = 0,
  Fumigation = 1,
  HeatTreatment = 2,
  ColdTreatment = 3,
  Irradiation = 4,
  Chemical = 5,
}

export const PHYTO_TREATMENT_TYPE_LABELS: Readonly<
  Record<PhytoTreatmentType, string>
> = Object.freeze({
  [PhytoTreatmentType.None]: "None",
  [PhytoTreatmentType.Fumigation]: "Fumigation",
  [PhytoTreatmentType.HeatTreatment]: "Heat Treatment",
  [PhytoTreatmentType.ColdTreatment]: "Cold Treatment",
  [PhytoTreatmentType.Irradiation]: "Irradiation",
  [PhytoTreatmentType.Chemical]: "Chemical",
});

/** Mirror of `IPhytosanitaryCertificate.Certificate`. */
export interface PhytosanitaryCertificate {
  readonly certId: Bytes32;
  readonly batchId: Bytes32;
  readonly originCountry: Bytes32;
  readonly destinationCountry: Bytes32;
  readonly botanicalName: Bytes32;
  readonly treatment: PhytoTreatmentType;
  readonly issuer: Address;
  readonly documentHash: Bytes32;
  readonly issuedAt: bigint; // uint64
  readonly expiry: bigint; // uint64
  readonly revoked: boolean;
}

// ---------------------------------------------------------------------------
// HalalCertification — mirror of `IHalalCertification`
// ---------------------------------------------------------------------------

/** Mirror of `IHalalCertification.CertStatus`. */
export enum HalalCertStatus {
  None = 0,
  Active = 1,
  Suspended = 2,
  Revoked = 3,
  Expired = 4,
}

export const HALAL_CERT_STATUS_LABELS: Readonly<
  Record<HalalCertStatus, string>
> = Object.freeze({
  [HalalCertStatus.None]: "None",
  [HalalCertStatus.Active]: "Active",
  [HalalCertStatus.Suspended]: "Suspended",
  [HalalCertStatus.Revoked]: "Revoked",
  [HalalCertStatus.Expired]: "Expired",
});

/** Mirror of `IHalalCertification.Certificate`. */
export interface HalalCertificate {
  readonly certId: Bytes32;
  readonly batchId: Bytes32;
  readonly standard: Bytes32;
  readonly certifier: Address;
  readonly producer: Address;
  readonly documentHash: Bytes32;
  readonly issuedAt: bigint; // uint64
  readonly expiry: bigint; // uint64
  readonly status: HalalCertStatus;
}

// ---------------------------------------------------------------------------
// ProductRecallRegistry — mirror of `IProductRecallRegistry`
// ---------------------------------------------------------------------------

/** Mirror of `IProductRecallRegistry.Severity`. */
export enum RecallSeverity {
  Advisory = 0,
  Voluntary = 1,
  ClassIII = 2,
  ClassII = 3,
  ClassI = 4,
}

export const RECALL_SEVERITY_LABELS: Readonly<Record<RecallSeverity, string>> =
  Object.freeze({
    [RecallSeverity.Advisory]: "Advisory",
    [RecallSeverity.Voluntary]: "Voluntary",
    [RecallSeverity.ClassIII]: "Class III",
    [RecallSeverity.ClassII]: "Class II",
    [RecallSeverity.ClassI]: "Class I",
  });

/** Mirror of `IProductRecallRegistry.RecallState`. */
export enum RecallState {
  None = 0,
  Open = 1,
  Escalated = 2,
  Resolved = 3,
  Cancelled = 4,
}

export const RECALL_STATE_LABELS: Readonly<Record<RecallState, string>> =
  Object.freeze({
    [RecallState.None]: "None",
    [RecallState.Open]: "Open",
    [RecallState.Escalated]: "Escalated",
    [RecallState.Resolved]: "Resolved",
    [RecallState.Cancelled]: "Cancelled",
  });

/** Mirror of `IProductRecallRegistry.Recall`. */
export interface ProductRecall {
  readonly recallId: Bytes32;
  readonly batchId: Bytes32;
  readonly initiator: Address;
  readonly severity: RecallSeverity;
  readonly reasonHash: Bytes32;
  readonly affectedUnits: bigint;
  readonly remediatedUnits: bigint;
  readonly openedAt: bigint; // uint64
  readonly state: RecallState;
}

// ---------------------------------------------------------------------------
// ExportLicenseRegistry — mirror of `IExportLicenseRegistry`
// ---------------------------------------------------------------------------

/** Mirror of `IExportLicenseRegistry.LicenseState`. */
export enum ExportLicenseState {
  None = 0,
  Active = 1,
  Suspended = 2,
  Revoked = 3,
  Exhausted = 4,
  Expired = 5,
}

export const EXPORT_LICENSE_STATE_LABELS: Readonly<
  Record<ExportLicenseState, string>
> = Object.freeze({
  [ExportLicenseState.None]: "None",
  [ExportLicenseState.Active]: "Active",
  [ExportLicenseState.Suspended]: "Suspended",
  [ExportLicenseState.Revoked]: "Revoked",
  [ExportLicenseState.Exhausted]: "Exhausted",
  [ExportLicenseState.Expired]: "Expired",
});

/** Mirror of `IExportLicenseRegistry.License`. */
export interface ExportLicense {
  readonly licenseId: Bytes32;
  readonly exporter: Address;
  readonly commodityCode: Bytes32;
  readonly destinationCountry: Bytes32;
  readonly quantityCap: bigint;
  readonly quantityUsed: bigint;
  readonly authority: Address;
  readonly issuedAt: bigint; // uint64
  readonly expiry: bigint; // uint64
  readonly state: ExportLicenseState;
}

// ---------------------------------------------------------------------------
// DutyAndTariffCalculator — mirror of `IDutyAndTariffCalculator`
// ---------------------------------------------------------------------------

/** Mirror of `IDutyAndTariffCalculator.DutyRate`. */
export interface DutyRate {
  readonly dutyBps: number; // uint16
  readonly vatBps: number; // uint16
  readonly exciseBps: number; // uint16
  readonly preferential: boolean;
  readonly set: boolean;
}

/** Mirror of `IDutyAndTariffCalculator.Assessment`. */
export interface DutyAssessment {
  readonly customsValue: bigint;
  readonly dutyAmount: bigint;
  readonly vatAmount: bigint;
  readonly exciseAmount: bigint;
  readonly totalPayable: bigint;
}

// ---------------------------------------------------------------------------
// CustomsDeclaration — mirror of `ICustomsDeclaration`
// ---------------------------------------------------------------------------

/** Mirror of `ICustomsDeclaration.DeclarationState`. */
export enum CustomsDeclarationState {
  None = 0,
  Lodged = 1,
  Assessed = 2,
  Paid = 3,
  Released = 4,
  Held = 5,
  Cancelled = 6,
}

export const CUSTOMS_DECLARATION_STATE_LABELS: Readonly<
  Record<CustomsDeclarationState, string>
> = Object.freeze({
  [CustomsDeclarationState.None]: "None",
  [CustomsDeclarationState.Lodged]: "Lodged",
  [CustomsDeclarationState.Assessed]: "Assessed",
  [CustomsDeclarationState.Paid]: "Paid",
  [CustomsDeclarationState.Released]: "Released",
  [CustomsDeclarationState.Held]: "Held",
  [CustomsDeclarationState.Cancelled]: "Cancelled",
});

/** Mirror of `ICustomsDeclaration.Declaration`. */
export interface CustomsDeclaration {
  readonly declarationId: Bytes32;
  readonly batchId: Bytes32;
  readonly declarant: Address;
  readonly hsCode: Bytes32;
  readonly originCountry: Bytes32;
  readonly destinationCountry: Bytes32;
  readonly customsValue: bigint;
  readonly dutyAssessed: bigint;
  readonly token: Address;
  readonly state: CustomsDeclarationState;
}

// ---------------------------------------------------------------------------
// Request / response DTOs consumed by the api + web layers
// ---------------------------------------------------------------------------

/** Request body for a `TradeComplianceEngine.evaluate` proxy endpoint. */
export interface ComplianceScreeningRequest {
  readonly batchId: Bytes32;
  readonly exporter: Address;
  readonly importer: Address;
  readonly destinationCountry: Bytes32;
}

/**
 * Response of a compliance screening: the raw decision plus the failed checks
 * expanded from the on-chain `failedFlags` bitmask into named flags.
 */
export interface ComplianceScreeningResult {
  readonly batchId: Bytes32;
  readonly decision: ComplianceDecision;
  readonly decisionLabel: string;
  readonly failedFlags: readonly ComplianceCheckFlag[];
  readonly cleared: boolean;
  readonly evaluatedAt: bigint;
}

/** Discriminant for the certificate kinds surfaced by the compliance API. */
export type ComplianceCertificateKind = "origin" | "phytosanitary" | "halal";

/** List/pagination query accepted by compliance certificate endpoints. */
export interface ComplianceCertificateListQuery {
  readonly kind?: ComplianceCertificateKind;
  readonly batchId?: Bytes32;
  readonly issuer?: Address;
  readonly includeRevoked?: boolean;
  readonly limit?: number;
  readonly cursor?: string;
}
