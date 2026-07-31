/**
 * Builtin scorers: the two dimensions the base engine reconciles.
 *
 *   - `model`: the model-proposed score, validated (never trusted blindly).
 *   - `rules`: the deterministic score recomputed from finding severities.
 *
 * Registered model-first so a tie resolves to `model`, exactly reproducing the
 * legacy `reconcileScore` semantics. Fill agents add further dimensions
 * (authenticity, consistency, compliance, completeness) as sibling files; under
 * strict-min they can only make the verdict stricter.
 */
import { assertValidModelScore, computeRuleScore } from '../domain/scoring.js';
import { registerScorer } from './registry.js';

export const modelScorer = registerScorer({
  dimension: 'model',
  description: 'The model-proposed risk score, validated to [0, 10000].',
  weight: 1,
  score: (ctx) => ({
    dimension: 'model',
    score: assertValidModelScore(ctx.modelScore),
    detail: 'Model-proposed score after range validation.',
  }),
});

export const rulesScorer = registerScorer({
  dimension: 'rules',
  description: 'Deterministic score from finding severities (critical → 0).',
  weight: 1,
  score: (ctx) => ({
    dimension: 'rules',
    score: computeRuleScore(ctx.findings),
    detail: 'Recomputed from cross-check + model findings.',
  }),
});
