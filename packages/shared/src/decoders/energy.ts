/**
 * `energy` domain event decoders.
 *
 * Strongly-typed viem event-log decoders for the key events emitted by the
 * `src/energy/` contracts. Each decoder resolves the raw log against the
 * specific contract ABI (via {@link decodeContractEvent}), then validates and
 * normalizes the args with zod into an immutable, branded event object.
 *
 * A decoder returns `null` when the log is a different event (an expected miss)
 * and throws {@link ValidationError} when the log matches the target event
 * signature but carries a malformed payload — it never silently coerces.
 *
 * Re-exported by `../decoders/index.ts`.
 */
import { z } from "zod";

import type { ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema, type Bytes32 } from "../types";
import { EnergySource } from "../types/energy";

import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Shared field schemas + decoder factory
// ---------------------------------------------------------------------------

const bytes32 = Bytes32Schema.transform((v): Bytes32 => v as Bytes32);
const address = AddressSchema;
/** uint64 / uint256 decode to `bigint` under viem. */
const big = z.bigint();
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
// RenewableEnergyCertificate
// ---------------------------------------------------------------------------

const RecClassRegisteredSchema = z.object({
  tokenId: big,
  facilityId: bytes32,
  source: z.nativeEnum(EnergySource),
  vintageYear: u16,
});
export type RecClassRegisteredEvent = z.infer<typeof RecClassRegisteredSchema>;
export const decodeRecClassRegistered = makeEventDecoder(
  "RenewableEnergyCertificate",
  "ClassRegistered",
  RecClassRegisteredSchema,
);

const RecCertificateIssuedSchema = z.object({
  tokenId: big,
  facilityId: bytes32,
  source: z.nativeEnum(EnergySource),
  vintageYear: u16,
  mwh: big,
});
export type RecCertificateIssuedEvent = z.infer<
  typeof RecCertificateIssuedSchema
>;
export const decodeRecCertificateIssued = makeEventDecoder(
  "RenewableEnergyCertificate",
  "CertificateIssued",
  RecCertificateIssuedSchema,
);

const RecCertificateRetiredSchema = z.object({
  account: address,
  tokenId: big,
  mwh: big,
  beneficiary: bytes32,
});
export type RecCertificateRetiredEvent = z.infer<
  typeof RecCertificateRetiredSchema
>;
export const decodeRecCertificateRetired = makeEventDecoder(
  "RenewableEnergyCertificate",
  "CertificateRetired",
  RecCertificateRetiredSchema,
);

// ---------------------------------------------------------------------------
// EmissionsTrading
// ---------------------------------------------------------------------------

const EmissionsPeriodOpenedSchema = z.object({
  periodId: bytes32,
  cap: big,
  startsAt: big,
  endsAt: big,
});
export type EmissionsPeriodOpenedEvent = z.infer<
  typeof EmissionsPeriodOpenedSchema
>;
export const decodeEmissionsPeriodOpened = makeEventDecoder(
  "EmissionsTrading",
  "PeriodOpened",
  EmissionsPeriodOpenedSchema,
);

const EmissionsAllocatedSchema = z.object({
  periodId: bytes32,
  installation: address,
  amount: big,
});
export type EmissionsAllocatedEvent = z.infer<typeof EmissionsAllocatedSchema>;
export const decodeEmissionsAllocated = makeEventDecoder(
  "EmissionsTrading",
  "Allocated",
  EmissionsAllocatedSchema,
);

const EmissionsTransferredSchema = z.object({
  periodId: bytes32,
  from: address,
  to: address,
  amount: big,
});
export type EmissionsTransferredEvent = z.infer<
  typeof EmissionsTransferredSchema
>;
export const decodeEmissionsTransferred = makeEventDecoder(
  "EmissionsTrading",
  "Transferred",
  EmissionsTransferredSchema,
);

const EmissionsReportedSchema = z.object({
  periodId: bytes32,
  installation: address,
  tCO2e: big,
});
export type EmissionsReportedEvent = z.infer<typeof EmissionsReportedSchema>;
export const decodeEmissionsReported = makeEventDecoder(
  "EmissionsTrading",
  "EmissionsReported",
  EmissionsReportedSchema,
);

const EmissionsSurrenderedSchema = z.object({
  periodId: bytes32,
  installation: address,
  amount: big,
});
export type EmissionsSurrenderedEvent = z.infer<
  typeof EmissionsSurrenderedSchema
>;
export const decodeEmissionsSurrendered = makeEventDecoder(
  "EmissionsTrading",
  "Surrendered",
  EmissionsSurrenderedSchema,
);

const EmissionsPeriodClosedSchema = z.object({ periodId: bytes32 });
export type EmissionsPeriodClosedEvent = z.infer<
  typeof EmissionsPeriodClosedSchema
>;
export const decodeEmissionsPeriodClosed = makeEventDecoder(
  "EmissionsTrading",
  "PeriodClosed",
  EmissionsPeriodClosedSchema,
);

// ---------------------------------------------------------------------------
// WaterCredit
// ---------------------------------------------------------------------------

const WaterProjectRegisteredSchema = z.object({
  projectId: bytes32,
  steward: address,
  basin: bytes32,
  methodology: bytes32,
});
export type WaterProjectRegisteredEvent = z.infer<
  typeof WaterProjectRegisteredSchema
>;
export const decodeWaterProjectRegistered = makeEventDecoder(
  "WaterCredit",
  "ProjectRegistered",
  WaterProjectRegisteredSchema,
);

const WaterProjectVerifiedSchema = z.object({ projectId: bytes32 });
export type WaterProjectVerifiedEvent = z.infer<
  typeof WaterProjectVerifiedSchema
>;
export const decodeWaterProjectVerified = makeEventDecoder(
  "WaterCredit",
  "ProjectVerified",
  WaterProjectVerifiedSchema,
);

const WaterCreditsIssuedSchema = z.object({
  projectId: bytes32,
  to: address,
  amount: big,
});
export type WaterCreditsIssuedEvent = z.infer<typeof WaterCreditsIssuedSchema>;
export const decodeWaterCreditsIssued = makeEventDecoder(
  "WaterCredit",
  "CreditsIssued",
  WaterCreditsIssuedSchema,
);

const WaterCreditsRetiredSchema = z.object({
  projectId: bytes32,
  account: address,
  amount: big,
  beneficiary: bytes32,
});
export type WaterCreditsRetiredEvent = z.infer<
  typeof WaterCreditsRetiredSchema
>;
export const decodeWaterCreditsRetired = makeEventDecoder(
  "WaterCredit",
  "CreditsRetired",
  WaterCreditsRetiredSchema,
);

// ---------------------------------------------------------------------------
// BiodiversityCredit
// ---------------------------------------------------------------------------

const BiodiversityProjectRegisteredSchema = z.object({
  projectId: bytes32,
  steward: address,
  habitat: bytes32,
  methodology: bytes32,
  areaHectares: u32,
});
export type BiodiversityProjectRegisteredEvent = z.infer<
  typeof BiodiversityProjectRegisteredSchema
>;
export const decodeBiodiversityProjectRegistered = makeEventDecoder(
  "BiodiversityCredit",
  "ProjectRegistered",
  BiodiversityProjectRegisteredSchema,
);

const BiodiversityProjectVerifiedSchema = z.object({
  projectId: bytes32,
  baselineScore: big,
  upliftScore: big,
});
export type BiodiversityProjectVerifiedEvent = z.infer<
  typeof BiodiversityProjectVerifiedSchema
>;
export const decodeBiodiversityProjectVerified = makeEventDecoder(
  "BiodiversityCredit",
  "ProjectVerified",
  BiodiversityProjectVerifiedSchema,
);

const BiodiversityCreditsIssuedSchema = z.object({
  projectId: bytes32,
  to: address,
  amount: big,
});
export type BiodiversityCreditsIssuedEvent = z.infer<
  typeof BiodiversityCreditsIssuedSchema
>;
export const decodeBiodiversityCreditsIssued = makeEventDecoder(
  "BiodiversityCredit",
  "CreditsIssued",
  BiodiversityCreditsIssuedSchema,
);

const BiodiversityCreditsRetiredSchema = z.object({
  projectId: bytes32,
  account: address,
  amount: big,
  beneficiary: bytes32,
});
export type BiodiversityCreditsRetiredEvent = z.infer<
  typeof BiodiversityCreditsRetiredSchema
>;
export const decodeBiodiversityCreditsRetired = makeEventDecoder(
  "BiodiversityCredit",
  "CreditsRetired",
  BiodiversityCreditsRetiredSchema,
);

// ---------------------------------------------------------------------------
// GreenBondIssuer
// ---------------------------------------------------------------------------

const GreenBondCreatedSchema = z.object({
  bondId: bytes32,
  issuer: address,
  token: address,
  principalTarget: big,
  couponBps: u16,
  greenCategory: bytes32,
});
export type GreenBondCreatedEvent = z.infer<typeof GreenBondCreatedSchema>;
export const decodeGreenBondCreated = makeEventDecoder(
  "GreenBondIssuer",
  "BondCreated",
  GreenBondCreatedSchema,
);

const GreenBondSubscribedSchema = z.object({
  bondId: bytes32,
  investor: address,
  amount: big,
});
export type GreenBondSubscribedEvent = z.infer<
  typeof GreenBondSubscribedSchema
>;
export const decodeGreenBondSubscribed = makeEventDecoder(
  "GreenBondIssuer",
  "Subscribed",
  GreenBondSubscribedSchema,
);

const GreenBondCouponFundedSchema = z.object({
  bondId: bytes32,
  period: u16,
  amount: big,
});
export type GreenBondCouponFundedEvent = z.infer<
  typeof GreenBondCouponFundedSchema
>;
export const decodeGreenBondCouponFunded = makeEventDecoder(
  "GreenBondIssuer",
  "CouponFunded",
  GreenBondCouponFundedSchema,
);

const GreenBondCouponClaimedSchema = z.object({
  bondId: bytes32,
  investor: address,
  amount: big,
});
export type GreenBondCouponClaimedEvent = z.infer<
  typeof GreenBondCouponClaimedSchema
>;
export const decodeGreenBondCouponClaimed = makeEventDecoder(
  "GreenBondIssuer",
  "CouponClaimed",
  GreenBondCouponClaimedSchema,
);

const GreenBondRedeemedSchema = z.object({
  bondId: bytes32,
  investor: address,
  principal: big,
});
export type GreenBondRedeemedEvent = z.infer<typeof GreenBondRedeemedSchema>;
export const decodeGreenBondRedeemed = makeEventDecoder(
  "GreenBondIssuer",
  "Redeemed",
  GreenBondRedeemedSchema,
);
