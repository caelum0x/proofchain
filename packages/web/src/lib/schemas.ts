import { isAddress } from "viem";
import { z } from "zod";
import { isBytes32 } from "./hashing";

/**
 * zod schemas for every form boundary. react-hook-form resolves against these,
 * so invalid input can never reach a contract call. Inputs are human-friendly
 * (labels, decimals) and transformed into on-chain values by the hooks.
 */

const addressField = z
  .string()
  .trim()
  // Annotate the predicate return type as `boolean` so TS 5.5+ does not infer a
  // type predicate here — form fields stay plain `string` (raw user input that
  // is normalized to a branded on-chain type only at the point of use).
  .refine((v): boolean => isAddress(v), { message: "Enter a valid 0x… address" });

const referenceField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(200, "Too long (max 200 chars)");

const decimalAmountField = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .regex(/^\d+(\.\d+)?$/, "Enter a positive number")
  .refine((v) => Number(v) > 0, { message: "Amount must be greater than zero" });

const metadataUriField = z
  .string()
  .trim()
  .min(1, "Metadata URI is required")
  .max(500, "Too long (max 500 chars)")
  .refine(
    (v) => /^(https?|ipfs):\/\//.test(v),
    { message: "Must be an http(s):// or ipfs:// URI" },
  );

/** Either a raw bytes32 id or a friendly reference we will hash. */
const batchIdField = z
  .string()
  .trim()
  .min(1, "Batch id or reference is required")
  .max(200, "Too long");

export const registerBatchSchema = z.object({
  reference: referenceField.describe("Batch reference (label or SKU)"),
  origin: referenceField.describe("Origin descriptor"),
  metadataURI: metadataUriField,
});
export type RegisterBatchInput = z.infer<typeof registerBatchSchema>;

export const addCheckpointSchema = z.object({
  batchId: batchIdField,
  location: z.string().trim().min(1, "Location is required").max(200, "Too long"),
  occurredAt: z
    .string()
    .trim()
    .min(1, "Timestamp is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date/time" }),
  dataReference: z
    .string()
    .trim()
    .min(1, "Data reference is required")
    .max(200, "Too long"),
});
export type AddCheckpointInput = z.infer<typeof addCheckpointSchema>;

export const fundDealSchema = z.object({
  batchId: batchIdField,
  supplier: addressField,
  amount: decimalAmountField,
});
export type FundDealInput = z.infer<typeof fundDealSchema>;

export const faucetSchema = z.object({
  amount: decimalAmountField,
});
export type FaucetInput = z.infer<typeof faucetSchema>;

/** Raw bytes32 required (verification targets an already-registered batch). */
export const verifyRequestSchema = z.object({
  batchId: z
    .string()
    .trim()
    // See `addressField`: keep the form field a plain `string`, not a narrowed
    // `0x${string}`, so react-hook-form default values and handlers type-check.
    .refine((v): boolean => isBytes32(v), { message: "Batch id must be a 0x… 32-byte hex value" }),
});
export type VerifyRequestInput = z.infer<typeof verifyRequestSchema>;

export const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15 MB per document
export const ACCEPTED_DOC_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function validateDocumentFile(file: File): string | null {
  if (file.size === 0) return `${file.name}: file is empty`;
  if (file.size > MAX_DOC_BYTES) {
    return `${file.name}: exceeds ${Math.round(MAX_DOC_BYTES / (1024 * 1024))} MB limit`;
  }
  const accepted = ACCEPTED_DOC_TYPES.some((t) => t === file.type);
  if (!accepted) {
    return `${file.name}: unsupported type (${file.type || "unknown"})`;
  }
  return null;
}
