/**
 * `compliance` domain event decoders.
 *
 * Typed viem-log decoders for the key events emitted by the `src/compliance/*`
 * contracts, plus the pure `decodeComplianceFlags` bitmask helper. Each decoder
 * asserts the log belongs to the expected contract+event (throwing
 * {@link DecodeError} otherwise), then narrows viem's loosely-typed `args`
 * record into an immutable, strongly-typed event object (throwing
 * {@link ValidationError} on a malformed field). viem returns every Solidity
 * integer as `bigint`; small uints and enum ordinals are range-checked and
 * narrowed against the mirrors in `../types/compliance`.
 *
 * Re-exported by `../decoders/index.ts`.
 */
import type { ContractName } from "../abis/index";
import { DecodeError, ValidationError } from "../errors";
import type { Address, Bytes32 } from "../types/core";
import {
  AmlRiskRating,
  ComplianceCheckFlag,
  ComplianceDecision,
  OriginType,
  PhytoTreatmentType,
  RecallSeverity,
  SanctionListSource,
  COMPLIANCE_CHECK_FLAGS,
} from "../types/compliance";
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

function asBool(args: EventArgs, key: string): boolean {
  const value = field(args, key);
  if (typeof value !== "boolean") {
    throw new ValidationError(`Field "${key}" is not a bool`, { key });
  }
  return value;
}

/** Read a uint enum ordinal and assert it is one of `valid`. */
function asEnum<E extends number>(
  args: EventArgs,
  key: string,
  valid: readonly E[],
): E {
  const raw = asNumber(args, key);
  if (!valid.includes(raw as E)) {
    throw new ValidationError(`Field "${key}" is not a valid enum value`, {
      key,
      value: raw,
    });
  }
  return raw as E;
}

const SANCTION_SOURCE_VALUES: readonly SanctionListSource[] = [
  SanctionListSource.Unknown,
  SanctionListSource.OFAC,
  SanctionListSource.EU,
  SanctionListSource.UN,
  SanctionListSource.UK,
  SanctionListSource.Other,
];

const AML_RATING_VALUES: readonly AmlRiskRating[] = [
  AmlRiskRating.Unrated,
  AmlRiskRating.Low,
  AmlRiskRating.Medium,
  AmlRiskRating.High,
  AmlRiskRating.Prohibited,
];

const DECISION_VALUES: readonly ComplianceDecision[] = [
  ComplianceDecision.Pending,
  ComplianceDecision.Cleared,
  ComplianceDecision.Blocked,
  ComplianceDecision.NeedsReview,
];

const ORIGIN_TYPE_VALUES: readonly OriginType[] = [
  OriginType.NonPreferential,
  OriginType.Preferential,
];

const TREATMENT_VALUES: readonly PhytoTreatmentType[] = [
  PhytoTreatmentType.None,
  PhytoTreatmentType.Fumigation,
  PhytoTreatmentType.HeatTreatment,
  PhytoTreatmentType.ColdTreatment,
  PhytoTreatmentType.Irradiation,
  PhytoTreatmentType.Chemical,
];

const SEVERITY_VALUES: readonly RecallSeverity[] = [
  RecallSeverity.Advisory,
  RecallSeverity.Voluntary,
  RecallSeverity.ClassIII,
  RecallSeverity.ClassII,
  RecallSeverity.ClassI,
];

// ---------------------------------------------------------------------------
// Compliance flag bitmask helper (pure)
// ---------------------------------------------------------------------------

/** Largest bitmask that only sets known compliance-flag bits. */
const COMPLIANCE_FLAG_MASK = COMPLIANCE_CHECK_FLAGS.reduce(
  (mask, flag) => mask | (1 << flag),
  0,
);

/**
 * Expand a `failedFlags` / `requiredFlags` uint32 bitmask (as emitted by
 * `TradeComplianceEngine`) into its named {@link ComplianceCheckFlag}s, in
 * bit-position order.
 *
 * @throws {ValidationError} if `bitmask` is not a non-negative safe integer or
 *   sets a bit outside the known flag range (guards against silent data drift).
 */
export function decodeComplianceFlags(
  bitmask: number,
): readonly ComplianceCheckFlag[] {
  if (!Number.isInteger(bitmask) || bitmask < 0) {
    throw new ValidationError("Compliance flag bitmask must be a uint", {
      value: bitmask,
    });
  }
  if ((bitmask & ~COMPLIANCE_FLAG_MASK) !== 0) {
    throw new ValidationError("Compliance flag bitmask sets an unknown bit", {
      value: bitmask,
      knownMask: COMPLIANCE_FLAG_MASK,
    });
  }
  return Object.freeze(
    COMPLIANCE_CHECK_FLAGS.filter((flag) => (bitmask & (1 << flag)) !== 0),
  );
}

// ---------------------------------------------------------------------------
// SanctionsScreening
// ---------------------------------------------------------------------------

export interface SanctionAddressListedEvent {
  readonly account: Address;
  readonly source: SanctionListSource;
  readonly reasonHash: Bytes32;
}

export function decodeSanctionAddressListed(
  log: unknown,
): SanctionAddressListedEvent {
  const a = requireEvent("SanctionsScreening", "AddressListed", log);
  return Object.freeze({
    account: asAddress(a, "account"),
    source: asEnum(a, "source", SANCTION_SOURCE_VALUES),
    reasonHash: asBytes32(a, "reasonHash"),
  });
}

export interface SanctionEntityListedEvent {
  readonly entityHash: Bytes32;
  readonly source: SanctionListSource;
  readonly reasonHash: Bytes32;
}

export function decodeSanctionEntityListed(
  log: unknown,
): SanctionEntityListedEvent {
  const a = requireEvent("SanctionsScreening", "EntityListed", log);
  return Object.freeze({
    entityHash: asBytes32(a, "entityHash"),
    source: asEnum(a, "source", SANCTION_SOURCE_VALUES),
    reasonHash: asBytes32(a, "reasonHash"),
  });
}

// ---------------------------------------------------------------------------
// AMLRegistry
// ---------------------------------------------------------------------------

export interface AmlRiskRatedEvent {
  readonly account: Address;
  readonly rating: AmlRiskRating;
  readonly evidenceHash: Bytes32;
}

export function decodeAmlRiskRated(log: unknown): AmlRiskRatedEvent {
  const a = requireEvent("AMLRegistry", "RiskRated", log);
  return Object.freeze({
    account: asAddress(a, "account"),
    rating: asEnum(a, "rating", AML_RATING_VALUES),
    evidenceHash: asBytes32(a, "evidenceHash"),
  });
}

export interface AmlSarFiledEvent {
  readonly sarId: Bytes32;
  readonly subject: Address;
  readonly detailsHash: Bytes32;
}

export function decodeAmlSarFiled(log: unknown): AmlSarFiledEvent {
  const a = requireEvent("AMLRegistry", "SARFiled", log);
  return Object.freeze({
    sarId: asBytes32(a, "sarId"),
    subject: asAddress(a, "subject"),
    detailsHash: asBytes32(a, "detailsHash"),
  });
}

// ---------------------------------------------------------------------------
// TradeComplianceEngine
// ---------------------------------------------------------------------------

export interface ComplianceEvaluatedEvent {
  readonly batchId: Bytes32;
  readonly decision: ComplianceDecision;
  readonly failedFlags: number;
  /** `failedFlags` expanded into named checks (bit-position order). */
  readonly failed: readonly ComplianceCheckFlag[];
}

export function decodeComplianceEvaluated(
  log: unknown,
): ComplianceEvaluatedEvent {
  const a = requireEvent("TradeComplianceEngine", "Evaluated", log);
  const failedFlags = asNumber(a, "failedFlags");
  return Object.freeze({
    batchId: asBytes32(a, "batchId"),
    decision: asEnum(a, "decision", DECISION_VALUES),
    failedFlags,
    failed: decodeComplianceFlags(failedFlags),
  });
}

// ---------------------------------------------------------------------------
// CertificateOfOrigin
// ---------------------------------------------------------------------------

export interface CertificateOfOriginIssuedEvent {
  readonly certId: Bytes32;
  readonly batchId: Bytes32;
  readonly originCountry: Bytes32;
  readonly originType: OriginType;
  readonly issuer: Address;
  readonly expiry: bigint;
}

export function decodeCertificateOfOriginIssued(
  log: unknown,
): CertificateOfOriginIssuedEvent {
  const a = requireEvent("CertificateOfOrigin", "Issued", log);
  return Object.freeze({
    certId: asBytes32(a, "certId"),
    batchId: asBytes32(a, "batchId"),
    originCountry: asBytes32(a, "originCountry"),
    originType: asEnum(a, "originType", ORIGIN_TYPE_VALUES),
    issuer: asAddress(a, "issuer"),
    expiry: asBigInt(a, "expiry"),
  });
}

// ---------------------------------------------------------------------------
// PhytosanitaryCertificate
// ---------------------------------------------------------------------------

export interface PhytosanitaryIssuedEvent {
  readonly certId: Bytes32;
  readonly batchId: Bytes32;
  readonly originCountry: Bytes32;
  readonly destinationCountry: Bytes32;
  readonly treatment: PhytoTreatmentType;
  readonly expiry: bigint;
}

export function decodePhytosanitaryIssued(
  log: unknown,
): PhytosanitaryIssuedEvent {
  const a = requireEvent("PhytosanitaryCertificate", "Issued", log);
  return Object.freeze({
    certId: asBytes32(a, "certId"),
    batchId: asBytes32(a, "batchId"),
    originCountry: asBytes32(a, "originCountry"),
    destinationCountry: asBytes32(a, "destinationCountry"),
    treatment: asEnum(a, "treatment", TREATMENT_VALUES),
    expiry: asBigInt(a, "expiry"),
  });
}

// ---------------------------------------------------------------------------
// HalalCertification
// ---------------------------------------------------------------------------

export interface HalalIssuedEvent {
  readonly certId: Bytes32;
  readonly batchId: Bytes32;
  readonly standard: Bytes32;
  readonly certifier: Address;
  readonly expiry: bigint;
}

export function decodeHalalIssued(log: unknown): HalalIssuedEvent {
  const a = requireEvent("HalalCertification", "Issued", log);
  return Object.freeze({
    certId: asBytes32(a, "certId"),
    batchId: asBytes32(a, "batchId"),
    standard: asBytes32(a, "standard"),
    certifier: asAddress(a, "certifier"),
    expiry: asBigInt(a, "expiry"),
  });
}

// ---------------------------------------------------------------------------
// ProductRecallRegistry
// ---------------------------------------------------------------------------

export interface RecallOpenedEvent {
  readonly recallId: Bytes32;
  readonly batchId: Bytes32;
  readonly initiator: Address;
  readonly severity: RecallSeverity;
  readonly affectedUnits: bigint;
}

export function decodeRecallOpened(log: unknown): RecallOpenedEvent {
  const a = requireEvent("ProductRecallRegistry", "RecallOpened", log);
  return Object.freeze({
    recallId: asBytes32(a, "recallId"),
    batchId: asBytes32(a, "batchId"),
    initiator: asAddress(a, "initiator"),
    severity: asEnum(a, "severity", SEVERITY_VALUES),
    affectedUnits: asBigInt(a, "affectedUnits"),
  });
}

// ---------------------------------------------------------------------------
// ExportLicenseRegistry
// ---------------------------------------------------------------------------

export interface ExportLicenseGrantedEvent {
  readonly licenseId: Bytes32;
  readonly exporter: Address;
  readonly commodityCode: Bytes32;
  readonly destinationCountry: Bytes32;
  readonly quantityCap: bigint;
  readonly expiry: bigint;
}

export function decodeExportLicenseGranted(
  log: unknown,
): ExportLicenseGrantedEvent {
  const a = requireEvent("ExportLicenseRegistry", "Granted", log);
  return Object.freeze({
    licenseId: asBytes32(a, "licenseId"),
    exporter: asAddress(a, "exporter"),
    commodityCode: asBytes32(a, "commodityCode"),
    destinationCountry: asBytes32(a, "destinationCountry"),
    quantityCap: asBigInt(a, "quantityCap"),
    expiry: asBigInt(a, "expiry"),
  });
}

// ---------------------------------------------------------------------------
// DutyAndTariffCalculator
// ---------------------------------------------------------------------------

export interface DutyRateSetEvent {
  readonly hsCode: Bytes32;
  readonly originCountry: Bytes32;
  readonly destinationCountry: Bytes32;
  readonly dutyBps: number;
  readonly vatBps: number;
  readonly exciseBps: number;
  readonly preferential: boolean;
}

export function decodeDutyRateSet(log: unknown): DutyRateSetEvent {
  const a = requireEvent("DutyAndTariffCalculator", "RateSet", log);
  return Object.freeze({
    hsCode: asBytes32(a, "hsCode"),
    originCountry: asBytes32(a, "originCountry"),
    destinationCountry: asBytes32(a, "destinationCountry"),
    dutyBps: asNumber(a, "dutyBps"),
    vatBps: asNumber(a, "vatBps"),
    exciseBps: asNumber(a, "exciseBps"),
    preferential: asBool(a, "preferential"),
  });
}

// ---------------------------------------------------------------------------
// CustomsDeclaration
// ---------------------------------------------------------------------------

export interface CustomsLodgedEvent {
  readonly declarationId: Bytes32;
  readonly batchId: Bytes32;
  readonly declarant: Address;
  readonly hsCode: Bytes32;
  readonly customsValue: bigint;
}

export function decodeCustomsLodged(log: unknown): CustomsLodgedEvent {
  const a = requireEvent("CustomsDeclaration", "Lodged", log);
  return Object.freeze({
    declarationId: asBytes32(a, "declarationId"),
    batchId: asBytes32(a, "batchId"),
    declarant: asAddress(a, "declarant"),
    hsCode: asBytes32(a, "hsCode"),
    customsValue: asBigInt(a, "customsValue"),
  });
}

export interface CustomsAssessedEvent {
  readonly declarationId: Bytes32;
  readonly dutyAssessed: bigint;
}

export function decodeCustomsAssessed(log: unknown): CustomsAssessedEvent {
  const a = requireEvent("CustomsDeclaration", "Assessed", log);
  return Object.freeze({
    declarationId: asBytes32(a, "declarationId"),
    dutyAssessed: asBigInt(a, "dutyAssessed"),
  });
}
