/**
 * `workforce` domain event decoders.
 *
 * Strongly-typed viem event-log decoders for the key events emitted by the
 * `src/workforce/` contracts. Each decoder resolves the raw log against the
 * specific contract ABI (via {@link decodeContractEvent}), then validates and
 * normalizes the args with zod into an immutable, branded event object.
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
  ComplianceStanding,
  CredentialStatus,
  LaborFindingSeverity,
  LaborFindingState,
} from "../types/workforce";

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
// WorkerCredential
// ---------------------------------------------------------------------------

const CredentialIssuedSchema = z.object({
  tokenId: big,
  worker: address,
  issuer: address,
  role: bytes32,
});
export type CredentialIssuedEvent = z.infer<typeof CredentialIssuedSchema>;
export const decodeCredentialIssued = makeEventDecoder(
  "WorkerCredential",
  "CredentialIssued",
  CredentialIssuedSchema,
);

const CredentialStatusChangedSchema = z.object({
  tokenId: big,
  status: z.nativeEnum(CredentialStatus),
});
export type CredentialStatusChangedEvent = z.infer<
  typeof CredentialStatusChangedSchema
>;
export const decodeCredentialStatusChanged = makeEventDecoder(
  "WorkerCredential",
  "CredentialStatusChanged",
  CredentialStatusChangedSchema,
);

const CredentialRenewedSchema = z.object({
  tokenId: big,
  expiresAt: big,
});
export type CredentialRenewedEvent = z.infer<typeof CredentialRenewedSchema>;
export const decodeCredentialRenewed = makeEventDecoder(
  "WorkerCredential",
  "CredentialRenewed",
  CredentialRenewedSchema,
);

// ---------------------------------------------------------------------------
// SafetyTrainingRegistry
// ---------------------------------------------------------------------------

const CourseRegisteredSchema = z.object({
  courseId: bytes32,
  title: bytes32,
  validityDays: u32,
  provider: address,
});
export type CourseRegisteredEvent = z.infer<typeof CourseRegisteredSchema>;
export const decodeCourseRegistered = makeEventDecoder(
  "SafetyTrainingRegistry",
  "CourseRegistered",
  CourseRegisteredSchema,
);

const TrainingCompletedSchema = z.object({
  courseId: bytes32,
  worker: address,
  completedAt: big,
  expiresAt: big,
});
export type TrainingCompletedEvent = z.infer<typeof TrainingCompletedSchema>;
export const decodeTrainingCompleted = makeEventDecoder(
  "SafetyTrainingRegistry",
  "TrainingCompleted",
  TrainingCompletedSchema,
);

const CompletionRevokedSchema = z.object({
  courseId: bytes32,
  worker: address,
  reason: bytes32,
});
export type CompletionRevokedEvent = z.infer<typeof CompletionRevokedSchema>;
export const decodeCompletionRevoked = makeEventDecoder(
  "SafetyTrainingRegistry",
  "CompletionRevoked",
  CompletionRevokedSchema,
);

// ---------------------------------------------------------------------------
// MilestonePayroll
// ---------------------------------------------------------------------------

const AgreementCreatedSchema = z.object({
  agreementId: bytes32,
  employer: address,
  worker: address,
  token: address,
  totalAmount: big,
});
export type AgreementCreatedEvent = z.infer<typeof AgreementCreatedSchema>;
export const decodeAgreementCreated = makeEventDecoder(
  "MilestonePayroll",
  "AgreementCreated",
  AgreementCreatedSchema,
);

const MilestoneApprovedSchema = z.object({
  agreementId: bytes32,
  index: u16,
  attestationId: bytes32,
});
export type MilestoneApprovedEvent = z.infer<typeof MilestoneApprovedSchema>;
export const decodeMilestoneApproved = makeEventDecoder(
  "MilestonePayroll",
  "MilestoneApproved",
  MilestoneApprovedSchema,
);

const MilestoneReleasedSchema = z.object({
  agreementId: bytes32,
  index: u16,
  worker: address,
  amount: big,
});
export type MilestoneReleasedEvent = z.infer<typeof MilestoneReleasedSchema>;
export const decodeMilestoneReleased = makeEventDecoder(
  "MilestonePayroll",
  "MilestoneReleased",
  MilestoneReleasedSchema,
);

const AgreementCancelledSchema = z.object({
  agreementId: bytes32,
  refunded: big,
});
export type AgreementCancelledEvent = z.infer<typeof AgreementCancelledSchema>;
export const decodeAgreementCancelled = makeEventDecoder(
  "MilestonePayroll",
  "AgreementCancelled",
  AgreementCancelledSchema,
);

// ---------------------------------------------------------------------------
// SkillAttestation
// ---------------------------------------------------------------------------

const SkillAttestedSchema = z.object({
  attestationId: bytes32,
  worker: address,
  attester: address,
  skill: bytes32,
  level: u8,
});
export type SkillAttestedEvent = z.infer<typeof SkillAttestedSchema>;
export const decodeSkillAttested = makeEventDecoder(
  "SkillAttestation",
  "SkillAttested",
  SkillAttestedSchema,
);

const SkillAttestationRevokedSchema = z.object({
  attestationId: bytes32,
  reason: bytes32,
});
export type SkillAttestationRevokedEvent = z.infer<
  typeof SkillAttestationRevokedSchema
>;
export const decodeSkillAttestationRevoked = makeEventDecoder(
  "SkillAttestation",
  "AttestationRevoked",
  SkillAttestationRevokedSchema,
);

// ---------------------------------------------------------------------------
// LaborComplianceRegistry
// ---------------------------------------------------------------------------

const AuditOpenedSchema = z.object({
  auditId: bytes32,
  employer: address,
  auditor: address,
  standard: bytes32,
});
export type AuditOpenedEvent = z.infer<typeof AuditOpenedSchema>;
export const decodeAuditOpened = makeEventDecoder(
  "LaborComplianceRegistry",
  "AuditOpened",
  AuditOpenedSchema,
);

const FindingRecordedSchema = z.object({
  auditId: bytes32,
  findingId: bytes32,
  severity: z.nativeEnum(LaborFindingSeverity),
  dueBy: big,
});
export type FindingRecordedEvent = z.infer<typeof FindingRecordedSchema>;
export const decodeFindingRecorded = makeEventDecoder(
  "LaborComplianceRegistry",
  "FindingRecorded",
  FindingRecordedSchema,
);

const FindingStateChangedSchema = z.object({
  findingId: bytes32,
  state: z.nativeEnum(LaborFindingState),
});
export type FindingStateChangedEvent = z.infer<
  typeof FindingStateChangedSchema
>;
export const decodeFindingStateChanged = makeEventDecoder(
  "LaborComplianceRegistry",
  "FindingStateChanged",
  FindingStateChangedSchema,
);

const StandingChangedSchema = z.object({
  employer: address,
  standing: z.nativeEnum(ComplianceStanding),
});
export type StandingChangedEvent = z.infer<typeof StandingChangedSchema>;
export const decodeStandingChanged = makeEventDecoder(
  "LaborComplianceRegistry",
  "StandingChanged",
  StandingChangedSchema,
);
