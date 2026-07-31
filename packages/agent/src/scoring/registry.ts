/**
 * Scoring registry + reconcile aggregator.
 *
 * A `Scorer` maps one verification DIMENSION (authenticity, consistency,
 * compliance, risk, completeness, …) to a basis-point score in [0, 10000]
 * (higher = cleaner). The `reconcile` aggregator combines every registered
 * dimension into a single final score.
 *
 * The default aggregation is STRICT-MIN: the final score is the lowest of all
 * dimensions, so no single lax dimension can wave a shipment through. With only
 * the builtin `model` + `rules` dimensions registered this reproduces the
 * legacy `reconcileScore` exactly (see src/scoring/core.ts + tests).
 *
 * REGISTRATION CONVENTION
 *   Create `src/scoring/<dimension>.ts` that builds a `Scorer` and calls
 *   `registerScorer(...)`, then append a side-effect import to
 *   `src/scoring/index.ts`. Never edit this file.
 */
import { MAX_SCORE_BPS, MIN_SCORE_BPS } from '../config/constants.js';
import { createRegistry } from '../registry/registry.js';
import type { Finding } from '../shared.js';
import type { ParsedDocument, ProvenanceData } from '../domain/types.js';

/** Everything a scorer may inspect to produce its dimension score. */
export interface ScoringContext {
  readonly modelScore: number;
  readonly findings: readonly Finding[];
  readonly documents: readonly ParsedDocument[];
  readonly provenance: ProvenanceData;
}

export interface DimensionScore {
  readonly dimension: string;
  /** Basis points, 0..10000, higher = cleaner. */
  readonly score: number;
  /** Optional human-readable rationale. */
  readonly detail?: string;
}

export interface Scorer {
  /** Unique dimension id AND registry key, e.g. "authenticity". */
  readonly dimension: string;
  readonly description: string;
  /** Relative importance (reserved for weighted strategies; min ignores it). */
  readonly weight: number;
  score(ctx: ScoringContext): DimensionScore;
}

export interface ScoreReconciliation {
  readonly finalScore: number;
  readonly modelScore: number;
  readonly ruleScore: number;
  /** The dimension id that produced the final (lowest) score. */
  readonly source: string;
  readonly passed: boolean;
  readonly threshold: number;
  readonly dimensions: readonly DimensionScore[];
}

export const scorerRegistry = createRegistry<Scorer>({
  label: 'scorer',
  keyOf: (s) => s.dimension,
});

/** Register a scorer (called by each `src/scoring/<dimension>.ts` module). */
export const registerScorer = (scorer: Scorer): Scorer =>
  scorerRegistry.register(scorer);

const clampBps = (n: number): number =>
  Math.max(MIN_SCORE_BPS, Math.min(MAX_SCORE_BPS, Math.round(n)));

/**
 * Combine all registered dimensions into a final score using strict-min. The
 * winning `source` is the first dimension (registration order) holding the
 * minimum, matching the legacy model-wins-on-tie behaviour when `model` is
 * registered before `rules`.
 */
export const reconcile = (
  ctx: ScoringContext,
  threshold: number,
): ScoreReconciliation => {
  const scorers = scorerRegistry.all();
  if (scorers.length === 0) {
    throw new Error('reconcile called with no registered scorers');
  }

  const dimensions: DimensionScore[] = scorers.map((s) => {
    const dim = s.score(ctx);
    return { ...dim, score: clampBps(dim.score) };
  });

  let winner = dimensions[0] as DimensionScore;
  for (const dim of dimensions) {
    if (dim.score < winner.score) winner = dim;
  }

  const byDimension = new Map(dimensions.map((d) => [d.dimension, d.score]));
  const modelScore = byDimension.get('model') ?? winner.score;
  const ruleScore = byDimension.get('rules') ?? MAX_SCORE_BPS;

  return {
    finalScore: winner.score,
    modelScore,
    ruleScore,
    source: winner.dimension,
    passed: winner.score >= threshold,
    threshold,
    dimensions,
  };
};
