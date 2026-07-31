/**
 * Reconciler dimension.
 *
 * A self-contained "model-vs-rules" reconciliation expressed as a Scorer: it
 * recomputes the deterministic rule score from the finding severities, validates
 * the model-proposed score, and reports the STRICTER (lower) of the two — the
 * exact legacy `reconcileScore` value. Registering it as a dimension makes the
 * classic reconciliation visible in the dimension breakdown and, under the
 * registry's strict-min aggregation, it never relaxes the final score (it equals
 * min(model, rules), which the standalone model+rules dimensions already bound).
 */
import { assertValidModelScore, computeRuleScore } from '../domain/scoring.js';
import { registerScorer } from './registry.js';
import type { ScoringContext } from './registry.js';

export const reconcilerScorer = registerScorer({
  dimension: 'reconciled',
  description:
    'Stricter of the validated model score and the deterministic rule score (legacy reconciliation).',
  weight: 1,
  score: (ctx: ScoringContext) => {
    const model = assertValidModelScore(ctx.modelScore);
    const rules = computeRuleScore(ctx.findings);
    const reconciled = Math.min(model, rules);
    const source = model <= rules ? 'model' : 'rules';
    return {
      dimension: 'reconciled',
      score: reconciled,
      detail: `min(model=${model}, rules=${rules}) → ${source}`,
    };
  },
});
