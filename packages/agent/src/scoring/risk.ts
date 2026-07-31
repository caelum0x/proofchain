/**
 * Risk dimension.
 *
 * Folds the advisory risk signal back INTO the pass/fail score as a cleanliness
 * value: cleanliness = MAX - aggregate risk. The aggregate is a self-contained,
 * registry-independent figure (severity-weighted findings plus a weak-model
 * penalty) so the dimension is deterministic regardless of which risk lenses
 * happen to be loaded. Under strict-min reconciliation this can only make a
 * verdict stricter — a high-risk shipment cannot score clean.
 */
import { registerScorer } from './registry.js';
import { detailOf } from './util.js';
import { clampRiskBps, weightedSeverity } from '../risk/util.js';
import type { ScoringContext } from './registry.js';

/** Below this model score, thin confidence is itself a risk contribution. */
const WEAK_MODEL_THRESHOLD = 3_000;
const WEAK_MODEL_RISK_BPS = 1_500;
const MAX_CLEAN = 10_000;

const aggregateRisk = (
  ctx: ScoringContext,
): { risk: number; reasons: string[] } => {
  const { bps, factors } = weightedSeverity(ctx.findings);
  const reasons = [...factors];
  let risk = bps;
  if (ctx.modelScore < WEAK_MODEL_THRESHOLD) {
    risk += WEAK_MODEL_RISK_BPS;
    reasons.push(`weak_model_score(${ctx.modelScore})`);
  }
  return { risk: clampRiskBps(risk), reasons };
};

export const riskScorer = registerScorer({
  dimension: 'risk',
  description:
    'Cleanliness derived from the aggregate advisory risk (severity-weighted findings + weak-model penalty).',
  weight: 1,
  score: (ctx) => {
    const { risk, reasons } = aggregateRisk(ctx);
    return {
      dimension: 'risk',
      score: MAX_CLEAN - risk,
      detail: detailOf('risk', reasons),
    };
  },
});
