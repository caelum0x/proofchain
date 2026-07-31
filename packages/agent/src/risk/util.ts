/**
 * Shared, dependency-free helpers for the advisory risk models.
 *
 * Kept LOCAL to the risk category (this file is owned by the risk-scoring Fill
 * agent — it never edits foundation config) so every lens composes the same
 * primitives: a severity→basis-point weighting, finding lookups and a trade
 * exposure calculation. All helpers are pure and total.
 */
import type { Finding, FindingSeverity } from '../shared.js';
import type { ParsedDocument } from '../domain/types.js';

/**
 * Basis points of risk contributed per finding severity (higher = MORE risk).
 * `critical` saturates the band on its own, mirroring the deterministic
 * hard-fail semantics used by the rule scorer.
 */
export const RISK_SEVERITY_BPS: Record<FindingSeverity, number> = {
  info: 0,
  low: 300,
  medium: 900,
  high: 2_500,
  critical: 10_000,
};

/** Clamp a raw risk figure into the 0..10000 basis-point domain. */
export const clampRiskBps = (n: number): number =>
  Math.max(0, Math.min(10_000, Math.round(n)));

/** True when any finding carries the `critical` severity. */
export const hasCritical = (findings: readonly Finding[]): boolean =>
  findings.some((f) => f.severity === 'critical');

/** Count findings whose code is one of `codes`. */
export const countByCode = (
  findings: readonly Finding[],
  codes: ReadonlySet<string>,
): number => findings.reduce((n, f) => (codes.has(f.code) ? n + 1 : n), 0);

/**
 * Trade exposure (money at stake) across parsed documents. Prefers the sum of
 * invoice totals; if no invoice declares a total, falls back to the single
 * largest declared total so a lone valued document still registers exposure.
 */
export const tradeExposure = (documents: readonly ParsedDocument[]): number => {
  let invoiceTotal = 0;
  let maxTotal = 0;
  for (const doc of documents) {
    const value = doc.fields.total;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    if (value > maxTotal) maxTotal = value;
    if (doc.docType === 'invoice') invoiceTotal += value;
  }
  return invoiceTotal > 0 ? invoiceTotal : maxTotal;
};

export interface WeightedSeverity {
  readonly bps: number;
  readonly factors: readonly string[];
}

/**
 * Sum the severity weight of every finding matching `predicate`, recording a
 * human-readable factor per contributing finding for explainability.
 */
export const weightedSeverity = (
  findings: readonly Finding[],
  predicate: (finding: Finding) => boolean = () => true,
): WeightedSeverity => {
  let bps = 0;
  const factors: string[] = [];
  for (const finding of findings) {
    if (!predicate(finding)) continue;
    const add = RISK_SEVERITY_BPS[finding.severity];
    if (add > 0) {
      bps += add;
      factors.push(`${finding.code} (${finding.severity})`);
    }
  }
  return { bps, factors };
};

/** The canonical all-zero EVM address, used to detect an unset supplier. */
export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as const;
