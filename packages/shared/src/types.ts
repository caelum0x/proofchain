import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive branded schemas (validated at every boundary)
// ---------------------------------------------------------------------------

/** 0x-prefixed hex string of arbitrary length. */
export const HexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/u, "Expected a 0x-prefixed hex string");
export type Hex = `0x${string}`;

/** 20-byte EVM address (checksum not enforced here; use `parseAddress`). */
export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/u, "Expected a 20-byte 0x address")
  .transform((v) => v as `0x${string}`);
export type Address = `0x${string}`;

/** 32-byte hash / id. */
export const Bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, "Expected a 32-byte 0x hash");
export type Bytes32 = `0x${string}`;

/** Basis-points score in the inclusive range 0..10000. */
export const ScoreBpsSchema = z
  .number()
  .int("Score must be an integer")
  .min(0, "Score must be >= 0")
  .max(10000, "Score must be <= 10000");

// ---------------------------------------------------------------------------
// On-chain struct mirrors
// ---------------------------------------------------------------------------

/** Mirror of `ProvenanceRegistry.Batch`. */
export interface Batch {
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly originHash: Bytes32;
  readonly metadataURI: string;
  readonly createdAt: bigint;
  readonly exists: boolean;
}

/** Mirror of `ProvenanceRegistry.Checkpoint`. */
export interface Checkpoint {
  readonly batchId: Bytes32;
  readonly location: string;
  readonly timestamp: bigint;
  readonly dataHash: Bytes32;
}

/** Mirror of `AttestationRegistry.Attestation`. */
export interface Attestation {
  readonly batchId: Bytes32;
  readonly score: number; // uint16 bps, safely fits in JS number
  readonly verdictHash: Bytes32;
  readonly verdictURI: string;
  readonly attestedAt: bigint;
  readonly agent: Address;
  readonly exists: boolean;
}

/**
 * Mirror of `SettlementEscrow.DealState`. Numeric values MUST match the
 * Solidity enum ordering exactly.
 */
export enum DealState {
  None = 0,
  Funded = 1,
  Released = 2,
  Refunded = 3,
  Disputed = 4,
}

/** Human-readable labels for {@link DealState}, indexable by enum value. */
export const DEAL_STATE_LABELS: Readonly<Record<DealState, string>> = Object.freeze({
  [DealState.None]: "None",
  [DealState.Funded]: "Funded",
  [DealState.Released]: "Released",
  [DealState.Refunded]: "Refunded",
  [DealState.Disputed]: "Disputed",
});

/** Mirror of `SettlementEscrow.Deal`. */
export interface Deal {
  readonly batchId: Bytes32;
  readonly buyer: Address;
  readonly supplier: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly state: DealState;
}

// ---------------------------------------------------------------------------
// Agent verdict types (EXACTLY as defined in the spec)
// ---------------------------------------------------------------------------

export interface VerificationVerdict {
  batchId: `0x${string}`;
  score: number; // 0..10000 bps
  passed: boolean; // score >= threshold
  threshold: number; // bps used
  findings: Finding[]; // structured anomaly list
  documentHashes: string[]; // sha256 of each inspected doc
  verdictURI?: string; // IPFS URI once pinned
  createdAt: string; // ISO
  model: string; // agent model id
}

export interface Finding {
  code: string; // e.g. "INVOICE_TOTAL_MISMATCH"
  severity: "info" | "low" | "medium" | "high" | "critical";
  message: string;
  evidence?: Record<string, unknown>;
}

/** Allowed finding severities, ordered from least to most severe. */
export const FINDING_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

// ---------------------------------------------------------------------------
// Zod schemas for the verdict types (runtime validation of agent I/O)
// ---------------------------------------------------------------------------

export const FindingSchema: z.ZodType<Finding> = z.object({
  code: z.string().min(1, "Finding code must not be empty"),
  severity: z.enum(FINDING_SEVERITIES),
  message: z.string().min(1, "Finding message must not be empty"),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export const VerificationVerdictSchema: z.ZodType<VerificationVerdict> = z
  .object({
    batchId: Bytes32Schema.transform((v) => v as `0x${string}`),
    score: ScoreBpsSchema,
    passed: z.boolean(),
    threshold: ScoreBpsSchema,
    findings: z.array(FindingSchema),
    documentHashes: z.array(z.string().min(1)),
    verdictURI: z.string().min(1).optional(),
    createdAt: z.string().datetime({ offset: true }),
    model: z.string().min(1),
  })
  .superRefine((verdict, ctx) => {
    const expectedPass = verdict.score >= verdict.threshold;
    if (verdict.passed !== expectedPass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passed"],
        message: `"passed" (${verdict.passed}) is inconsistent with score ${verdict.score} vs threshold ${verdict.threshold}`,
      });
    }
  }) as unknown as z.ZodType<VerificationVerdict>;
