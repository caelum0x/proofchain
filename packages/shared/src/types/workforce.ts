/**
 * `workforce` domain types.
 *
 * TypeScript mirrors of the on-chain structs, enums and status values used by
 * the `src/workforce/` contracts (WorkerCredential, SafetyTrainingRegistry,
 * MilestonePayroll, SkillAttestation, LaborComplianceRegistry) plus the request
 * DTOs the api/web use to drive their write paths.
 *
 * Numeric enum values MUST match the Solidity `enum` declaration order exactly.
 * Every field is `readonly`; `bigint` mirrors uint256/uint64, `number` mirrors
 * uint8/uint16/uint32.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// WorkerCredential (soulbound ERC721 worker identity)
// ---------------------------------------------------------------------------

/** Mirror of `IWorkerCredential.CredentialStatus`. */
export enum CredentialStatus {
  None = 0,
  Active = 1,
  Suspended = 2,
  Revoked = 3,
}

export const CREDENTIAL_STATUS_LABELS: Readonly<
  Record<CredentialStatus, string>
> = Object.freeze({
  [CredentialStatus.None]: "None",
  [CredentialStatus.Active]: "Active",
  [CredentialStatus.Suspended]: "Suspended",
  [CredentialStatus.Revoked]: "Revoked",
});

/** Mirror of `IWorkerCredential.Credential`. */
export interface WorkerCredentialData {
  readonly tokenId: bigint;
  readonly worker: Address;
  readonly issuer: Address;
  readonly identityCommit: Bytes32;
  readonly role: Bytes32;
  readonly issuedAt: bigint; // uint64
  readonly expiresAt: bigint; // uint64
  readonly status: CredentialStatus;
}

// ---------------------------------------------------------------------------
// SafetyTrainingRegistry (occupational-health training completions)
// ---------------------------------------------------------------------------

/** Mirror of `ISafetyTrainingRegistry.Course`. */
export interface SafetyCourse {
  readonly courseId: Bytes32;
  readonly title: Bytes32;
  readonly validityDays: number; // uint32
  readonly provider: Address;
  readonly active: boolean;
}

/** Mirror of `ISafetyTrainingRegistry.Completion`. */
export interface SafetyCompletion {
  readonly courseId: Bytes32;
  readonly worker: Address;
  readonly completedAt: bigint; // uint64
  readonly expiresAt: bigint; // uint64
  readonly evidenceHash: Bytes32;
  readonly revoked: boolean;
}

// ---------------------------------------------------------------------------
// MilestonePayroll (stablecoin payroll paid per delivery milestone)
// ---------------------------------------------------------------------------

/** Mirror of `IMilestonePayroll.AgreementState`. */
export enum PayrollAgreementState {
  None = 0,
  Funded = 1,
  Active = 2,
  Completed = 3,
  Cancelled = 4,
}

export const PAYROLL_AGREEMENT_STATE_LABELS: Readonly<
  Record<PayrollAgreementState, string>
> = Object.freeze({
  [PayrollAgreementState.None]: "None",
  [PayrollAgreementState.Funded]: "Funded",
  [PayrollAgreementState.Active]: "Active",
  [PayrollAgreementState.Completed]: "Completed",
  [PayrollAgreementState.Cancelled]: "Cancelled",
});

/** Mirror of `IMilestonePayroll.MilestoneState`. */
export enum PayrollMilestoneState {
  Pending = 0,
  Approved = 1,
  Released = 2,
  Cancelled = 3,
}

export const PAYROLL_MILESTONE_STATE_LABELS: Readonly<
  Record<PayrollMilestoneState, string>
> = Object.freeze({
  [PayrollMilestoneState.Pending]: "Pending",
  [PayrollMilestoneState.Approved]: "Approved",
  [PayrollMilestoneState.Released]: "Released",
  [PayrollMilestoneState.Cancelled]: "Cancelled",
});

/** Mirror of `IMilestonePayroll.Agreement`. */
export interface PayrollAgreement {
  readonly agreementId: Bytes32;
  readonly employer: Address;
  readonly worker: Address;
  readonly token: Address;
  readonly totalAmount: bigint;
  readonly releasedAmount: bigint;
  readonly milestoneCount: number; // uint16
  readonly releasedCount: number; // uint16
  readonly state: PayrollAgreementState;
}

/** Mirror of `IMilestonePayroll.Milestone`. */
export interface PayrollMilestone {
  readonly descriptionHash: Bytes32;
  readonly amount: bigint;
  readonly attestationId: Bytes32;
  readonly state: PayrollMilestoneState;
}

// ---------------------------------------------------------------------------
// SkillAttestation (portable, verifiable skill graph)
// ---------------------------------------------------------------------------

/** Mirror of `ISkillAttestation.Attestation`. */
export interface SkillAttestationData {
  readonly attestationId: Bytes32;
  readonly worker: Address;
  readonly attester: Address;
  readonly skill: Bytes32;
  readonly framework: Bytes32;
  readonly level: number; // uint8
  readonly evidenceHash: Bytes32;
  readonly attestedAt: bigint; // uint64
  readonly expiresAt: bigint; // uint64
  readonly revoked: boolean;
}

// ---------------------------------------------------------------------------
// LaborComplianceRegistry (social audits, findings, standing)
// ---------------------------------------------------------------------------

/** Mirror of `ILaborComplianceRegistry.Severity`. */
export enum LaborFindingSeverity {
  None = 0,
  Minor = 1,
  Major = 2,
  Critical = 3,
}

export const LABOR_FINDING_SEVERITY_LABELS: Readonly<
  Record<LaborFindingSeverity, string>
> = Object.freeze({
  [LaborFindingSeverity.None]: "None",
  [LaborFindingSeverity.Minor]: "Minor",
  [LaborFindingSeverity.Major]: "Major",
  [LaborFindingSeverity.Critical]: "Critical",
});

/** Mirror of `ILaborComplianceRegistry.FindingState`. */
export enum LaborFindingState {
  None = 0,
  Open = 1,
  Remediating = 2,
  Resolved = 3,
  Waived = 4,
}

export const LABOR_FINDING_STATE_LABELS: Readonly<
  Record<LaborFindingState, string>
> = Object.freeze({
  [LaborFindingState.None]: "None",
  [LaborFindingState.Open]: "Open",
  [LaborFindingState.Remediating]: "Remediating",
  [LaborFindingState.Resolved]: "Resolved",
  [LaborFindingState.Waived]: "Waived",
});

/** Mirror of `ILaborComplianceRegistry.ComplianceStanding`. */
export enum ComplianceStanding {
  Unknown = 0,
  Compliant = 1,
  Watch = 2,
  NonCompliant = 3,
}

export const COMPLIANCE_STANDING_LABELS: Readonly<
  Record<ComplianceStanding, string>
> = Object.freeze({
  [ComplianceStanding.Unknown]: "Unknown",
  [ComplianceStanding.Compliant]: "Compliant",
  [ComplianceStanding.Watch]: "Watch",
  [ComplianceStanding.NonCompliant]: "NonCompliant",
});

/** Mirror of `ILaborComplianceRegistry.Audit`. */
export interface LaborAudit {
  readonly auditId: Bytes32;
  readonly employer: Address;
  readonly auditor: Address;
  readonly standard: Bytes32;
  readonly conductedAt: bigint; // uint64
  readonly findingCount: number; // uint16
  readonly openCount: number; // uint16
}

/** Mirror of `ILaborComplianceRegistry.Finding`. */
export interface LaborFinding {
  readonly findingId: Bytes32;
  readonly auditId: Bytes32;
  readonly severity: LaborFindingSeverity;
  readonly detailsHash: Bytes32;
  readonly dueBy: bigint; // uint64
  readonly state: LaborFindingState;
}

// ---------------------------------------------------------------------------
// Request DTOs (api/web write paths)
// ---------------------------------------------------------------------------

export interface IssueWorkerCredentialInput {
  readonly worker: Address;
  readonly identityCommit: Bytes32;
  readonly role: Bytes32;
  readonly expiresAt: bigint;
}

export interface RegisterSafetyCourseInput {
  readonly courseId: Bytes32;
  readonly title: Bytes32;
  readonly validityDays: number;
  readonly provider: Address;
}

export interface RecordCompletionInput {
  readonly courseId: Bytes32;
  readonly worker: Address;
  readonly evidenceHash: Bytes32;
}

export interface CreatePayrollAgreementInput {
  readonly agreementId: Bytes32;
  readonly worker: Address;
  readonly token: Address;
  readonly totalAmount: bigint;
  readonly milestoneAmounts: readonly bigint[];
  readonly descriptionHashes: readonly Bytes32[];
}

export interface AttestSkillInput {
  readonly attestationId: Bytes32;
  readonly worker: Address;
  readonly skill: Bytes32;
  readonly framework: Bytes32;
  readonly level: number;
  readonly evidenceHash: Bytes32;
  readonly expiresAt: bigint;
}

export interface OpenLaborAuditInput {
  readonly auditId: Bytes32;
  readonly employer: Address;
  readonly standard: Bytes32;
}

export interface RecordLaborFindingInput {
  readonly auditId: Bytes32;
  readonly findingId: Bytes32;
  readonly severity: LaborFindingSeverity;
  readonly detailsHash: Bytes32;
  readonly dueBy: bigint;
}
