/**
 * Shared, dependency-free helpers for the dimension scorers.
 *
 * Owned by the "risk-scoring" Fill category (never edits foundation config).
 * Dimension scorers report cleanliness in basis points (higher = cleaner), so
 * the common shape is: start at MAX_SCORE and DEDUCT for each relevant finding,
 * with a critical match hard-failing to zero — mirroring the deterministic rule
 * scorer's semantics but scoped to one dimension's finding subset.
 */
import { MAX_SCORE_BPS } from '../config/constants.js';
import type { Finding, FindingSeverity } from '../shared.js';

/** Cleanliness deduction (bps) per finding severity for dimension scorers. */
export const DIMENSION_DEDUCTION_BPS: Record<FindingSeverity, number> = {
  info: 0,
  low: 300,
  medium: 1_000,
  high: 3_000,
  critical: MAX_SCORE_BPS,
};

export interface DeductionResult {
  readonly score: number;
  readonly reasons: readonly string[];
}

/**
 * Start at MAX_SCORE and subtract the severity deduction of every finding that
 * matches `predicate`. Any critical match hard-fails the dimension to 0. Pure
 * and total; never mutates its inputs.
 */
export const scoreByDeduction = (
  findings: readonly Finding[],
  predicate: (finding: Finding) => boolean = () => true,
): DeductionResult => {
  let score = MAX_SCORE_BPS;
  const reasons: string[] = [];
  for (const finding of findings) {
    if (!predicate(finding)) continue;
    const deduction = DIMENSION_DEDUCTION_BPS[finding.severity];
    if (deduction <= 0) continue;
    if (deduction >= MAX_SCORE_BPS) {
      reasons.push(`${finding.code}=critical`);
      return { score: 0, reasons };
    }
    score -= deduction;
    reasons.push(`${finding.code}(-${deduction})`);
  }
  return { score: Math.max(0, score), reasons };
};

/** Predicate: finding code is a member of `codes`. */
export const byCodes =
  (codes: ReadonlySet<string>) =>
  (finding: Finding): boolean =>
    codes.has(finding.code);

/** Predicate: finding code starts with any of `prefixes`. */
export const byPrefixes =
  (prefixes: readonly string[]) =>
  (finding: Finding): boolean =>
    prefixes.some((prefix) => finding.code.startsWith(prefix));

/** Render a scorer detail string from its deduction reasons. */
export const detailOf = (label: string, reasons: readonly string[]): string =>
  reasons.length === 0 ? `${label}: no issues` : `${label}: ${reasons.join(', ')}`;
