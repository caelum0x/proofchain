/**
 * Zod schemas + view helpers for the compliance section.
 *
 * The sanctions/AML surfaces read on-chain from `KYCRegistry`; the trade-doc
 * surfaces (certificates, customs, duties, export licenses) read from the
 * ProofChain API via `lib/api.ts`. Every API shape is validated here at the
 * boundary — we never trust the raw response (WD §7). Statuses use `.catch` so
 * an unrecognised value degrades to "unknown" instead of throwing the page.
 */
import { z } from "zod";
import type { SemanticStatus } from "@/components/ui/StatusBadge";

// ─── Shared primitives ───────────────────────────────────────────────────────

const numericSchema = z.union([z.number(), z.string()]);
const isoDateSchema = z.union([z.number(), z.string()]).optional();

/** Coerce an API numeric-ish value to a number for display, or null. */
export function toNumber(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Format a date-ish API value (unix seconds, ms, or ISO string). */
export function formatDateish(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  let ms: number;
  if (typeof value === "number") ms = value < 1e12 ? value * 1000 : value;
  else {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) ms = asNum < 1e12 ? asNum * 1000 : asNum;
    else ms = Date.parse(value);
  }
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

/** Format a numeric-ish value as a localized amount. */
export function formatAmount(value: number | string | undefined | null, currency?: string): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const formatted = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

// ─── Certificates ────────────────────────────────────────────────────────────

export const CERTIFICATE_KINDS = ["origin", "phytosanitary", "halal", "other"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export const certificateSchema = z.object({
  id: z.string(),
  kind: z.string().optional(),
  batchId: z.string().optional(),
  holder: z.string().optional(),
  issuer: z.string().optional(),
  country: z.string().optional(),
  status: z.string().optional(),
  documentUri: z.string().optional(),
  issuedAt: isoDateSchema,
  expiresAt: isoDateSchema,
});
export type Certificate = z.infer<typeof certificateSchema>;

// ─── Customs declarations ────────────────────────────────────────────────────

export const customsSchema = z.object({
  id: z.string(),
  batchId: z.string().optional(),
  declarant: z.string().optional(),
  hsCode: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  value: numericSchema.optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  declaredAt: isoDateSchema,
});
export type CustomsDeclaration = z.infer<typeof customsSchema>;

// ─── Duty & tariff rates ─────────────────────────────────────────────────────

export const dutyRateSchema = z.object({
  id: z.string(),
  hsCode: z.string().optional(),
  description: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  dutyRateBps: numericSchema.optional(),
  vatRateBps: numericSchema.optional(),
  category: z.string().optional(),
});
export type DutyRate = z.infer<typeof dutyRateSchema>;

// ─── Export licenses ─────────────────────────────────────────────────────────

export const exportLicenseSchema = z.object({
  id: z.string(),
  licenseNumber: z.string().optional(),
  exporter: z.string().optional(),
  destination: z.string().optional(),
  goods: z.string().optional(),
  status: z.string().optional(),
  issuedAt: isoDateSchema,
  expiresAt: isoDateSchema,
});
export type ExportLicense = z.infer<typeof exportLicenseSchema>;

// ─── Sanctions screening ─────────────────────────────────────────────────────

export const sanctionsHitSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  listName: z.string().optional(),
  matchScore: numericSchema.optional(),
  status: z.string().optional(),
  screenedAt: isoDateSchema,
});
export type SanctionsHit = z.infer<typeof sanctionsHitSchema>;

// ─── Status → tone mapping ───────────────────────────────────────────────────

const GOOD = new Set(["valid", "active", "cleared", "clear", "approved", "verified"]);
const WARN = new Set(["pending", "held", "review", "expiring"]);
const BAD = new Set(["revoked", "expired", "rejected", "blocked", "flagged", "denied"]);

/** Map an arbitrary compliance status string to a semantic badge tone. */
export function complianceStatusTone(status: string | undefined): SemanticStatus {
  const s = (status ?? "").toLowerCase();
  if (GOOD.has(s)) return "success";
  if (WARN.has(s)) return "warn";
  if (BAD.has(s)) return "danger";
  return "neutral";
}

/** Present a status string in Title Case (falling back to "Unknown"). */
export function titleCase(value: string | undefined): string {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ─── KYC levels (KYCRegistry) ────────────────────────────────────────────────

export const KYC_LEVEL_LABELS: Readonly<Record<number, string>> = {
  0: "Unverified",
  1: "Basic",
  2: "Enhanced",
  3: "Institutional",
};

export function kycLevelLabel(level: number): string {
  return KYC_LEVEL_LABELS[level] ?? `Level ${level}`;
}

export function kycLevelTone(level: number): SemanticStatus {
  if (level <= 0) return "danger";
  if (level === 1) return "warn";
  return "success";
}

/** Duty calculator: compute payable duty + VAT from a customs value in bps. */
export function computeDuty(value: number, dutyBps: number, vatBps: number) {
  const duty = (value * dutyBps) / 10_000;
  const vat = ((value + duty) * vatBps) / 10_000;
  return { duty, vat, total: value + duty + vat };
}
