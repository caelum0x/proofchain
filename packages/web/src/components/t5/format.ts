import type { SemanticStatus } from "@/components/ui/StatusBadge";

/**
 * Presentational formatting helpers for the loosely-typed workforce + markets
 * API values (which may arrive as string | number | undefined). Pure + null-safe:
 * every helper degrades to an em dash rather than throwing on missing data.
 */

const EM_DASH = "—";

/** Coerce an unknown numeric-ish value to a finite number, or undefined. */
export function toNumber(value?: string | number | null): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Format a date-ish value: unix seconds, unix ms, or ISO string. */
export function fmtDate(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return EM_DASH;
  let date: Date;
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const n = Number(value);
    date = new Date(n < 1e12 ? n * 1000 : n);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

/** Format a plain number with thousands separators. */
export function fmtNumber(value?: string | number | null, options?: Intl.NumberFormatOptions): string {
  const n = toNumber(value);
  return n === undefined ? EM_DASH : n.toLocaleString(undefined, options);
}

/** Format a fiat/price-ish value with up to 2 decimals. */
export function fmtPrice(value?: string | number | null, currency = "USD"): string {
  const n = toNumber(value);
  if (n === undefined) return EM_DASH;
  return n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
}

/** Format a signed percentage change (already a percent, not bps). */
export function fmtChange(value?: string | number | null): string {
  const n = toNumber(value);
  if (n === undefined) return EM_DASH;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** Title-case a snake/kebab/lower status string. */
export function titleCase(value?: string | null): string {
  if (!value) return EM_DASH;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_TONES: Readonly<Record<string, SemanticStatus>> = {
  active: "success",
  valid: "success",
  verified: "success",
  approved: "success",
  paid: "success",
  settled: "success",
  completed: "success",
  passed: "success",
  filled: "success",
  pending: "warn",
  processing: "warn",
  submitted: "warn",
  review: "warn",
  scheduled: "info",
  expired: "danger",
  revoked: "danger",
  failed: "danger",
  rejected: "danger",
  cancelled: "neutral",
  redeemed: "neutral",
  inactive: "neutral",
};

/** Map a domain status string to a semantic badge tone. */
export function statusTone(value?: string | null): SemanticStatus {
  if (!value) return "neutral";
  return STATUS_TONES[value.toLowerCase()] ?? "neutral";
}

/** A tone hint for a signed change value (for StatCard hints). */
export function changeTone(value?: string | number | null): "success" | "danger" | "neutral" {
  const n = toNumber(value);
  if (n === undefined || n === 0) return "neutral";
  return n > 0 ? "success" : "danger";
}
