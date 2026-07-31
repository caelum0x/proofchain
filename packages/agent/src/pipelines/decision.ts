/**
 * Pure decision helpers shared by the domain pipelines (financing, insurance,
 * dpp, compliance, quality, esg, credit).
 *
 * Everything here is deterministic and side-effect free: severity math, basis-
 * point clamping, invoice aggregation, risk lookups and banded rating maps. The
 * pipelines layer domain policy on top of these primitives, so the primitives
 * stay small, total and independently unit-testable.
 */
import { MAX_SCORE_BPS, MIN_SCORE_BPS, SEVERITY_RANK } from '../config/constants.js';
import type { Finding, FindingSeverity } from '../shared.js';
import type { ParsedDocument } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

/** Round + clamp any number into the basis-point domain [0, 10000]. */
export const clampBps = (n: number): number =>
  Math.max(MIN_SCORE_BPS, Math.min(MAX_SCORE_BPS, Math.round(n)));

/** Convert a 0..1 unit value into basis points, clamped. Non-finite → 0. */
export const unitToBps = (x: number): number =>
  Number.isFinite(x) ? clampBps(x * MAX_SCORE_BPS) : 0;

/** Weighted average of basis-point values; missing entries carry no weight. */
export const weightedBps = (
  parts: ReadonlyArray<readonly [value: number, weight: number]>,
): number => {
  const active = parts.filter(([, w]) => w > 0);
  const totalWeight = active.reduce((acc, [, w]) => acc + w, 0);
  if (totalWeight <= 0) return MIN_SCORE_BPS;
  const sum = active.reduce((acc, [v, w]) => acc + v * w, 0);
  return clampBps(sum / totalWeight);
};

export const maxSeverityRank = (findings: readonly Finding[]): number =>
  findings.reduce((max, f) => Math.max(max, SEVERITY_RANK[f.severity]), 0);

export const hasCritical = (findings: readonly Finding[]): boolean =>
  findings.some((f) => f.severity === 'critical');

export const hasSeverityAtLeast = (
  findings: readonly Finding[],
  severity: FindingSeverity,
): boolean =>
  findings.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[severity]);

export const countAtLeast = (
  findings: readonly Finding[],
  severity: FindingSeverity,
): number =>
  findings.filter((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[severity])
    .length;

/** Human-readable `CODE: message` strings for findings at/above a severity. */
export const defectMessages = (
  findings: readonly Finding[],
  minSeverity: FindingSeverity,
): string[] =>
  findings
    .filter((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[minSeverity])
    .map((f) => `${f.code}: ${f.message}`);

/** Total declared value across all parsed invoices (0 when none present). */
export const invoiceValue = (documents: readonly ParsedDocument[]): number =>
  documents
    .filter((d) => d.docType === 'invoice')
    .reduce(
      (sum, d) => sum + (typeof d.fields.total === 'number' ? d.fields.total : 0),
      0,
    );

/** Look up a single risk assessment by model id. */
export const riskById = (
  risk: readonly RiskAssessment[],
  id: string,
): RiskAssessment | undefined => risk.find((r) => r.model === id);

/**
 * The worst (highest) risk score among the requested models. When none of them
 * are registered, fall back to the always-present `fraud` model, then 0.
 */
export const worstRiskScore = (
  risk: readonly RiskAssessment[],
  ...ids: string[]
): number => {
  const scores = ids
    .map((id) => riskById(risk, id)?.score)
    .filter((n): n is number => typeof n === 'number');
  if (scores.length > 0) return Math.max(...scores);
  return riskById(risk, 'fraud')?.score ?? 0;
};

export interface Band<T> {
  /** Inclusive lower bound in basis points. */
  readonly min: number;
  readonly value: T;
}

/**
 * Map a basis-point value to a banded label. `bands` MUST be ordered by
 * descending `min`; the first band whose threshold is met wins.
 */
export const band = <T>(
  bps: number,
  bands: ReadonlyArray<Band<T>>,
  fallback: T,
): T => {
  for (const b of bands) {
    if (bps >= b.min) return b.value;
  }
  return fallback;
};

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export const qualityGrade = (bps: number): QualityGrade =>
  band<QualityGrade>(
    bps,
    [
      { min: 9_000, value: 'A' },
      { min: 7_500, value: 'B' },
      { min: 6_000, value: 'C' },
      { min: 4_000, value: 'D' },
    ],
    'F',
  );

export type CreditRating =
  | 'AAA'
  | 'AA'
  | 'A'
  | 'BBB'
  | 'BB'
  | 'B'
  | 'CCC'
  | 'D';

export const creditRating = (bps: number): CreditRating =>
  band<CreditRating>(
    bps,
    [
      { min: 9_200, value: 'AAA' },
      { min: 8_500, value: 'AA' },
      { min: 7_700, value: 'A' },
      { min: 7_000, value: 'BBB' },
      { min: 6_000, value: 'BB' },
      { min: 5_000, value: 'B' },
      { min: 3_500, value: 'CCC' },
    ],
    'D',
  );

export type EsgRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';

export const esgRating = (bps: number): EsgRating =>
  band<EsgRating>(
    bps,
    [
      { min: 9_000, value: 'AAA' },
      { min: 8_000, value: 'AA' },
      { min: 7_000, value: 'A' },
      { min: 6_000, value: 'BBB' },
      { min: 4_500, value: 'BB' },
      { min: 3_000, value: 'B' },
    ],
    'CCC',
  );
