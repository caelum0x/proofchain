/**
 * DETERMINISTIC scoring reconciliation.
 *
 * The model proposes a score, but we never trust it blindly. We independently
 * recompute a rule-based score from the finding severities and take the
 * STRICTER (lower) of the two. This makes a passing verdict reproducible and
 * prevents a nondeterministic model from waving through a fraudulent shipment.
 */
import {
  MAX_SCORE_BPS,
  MIN_SCORE_BPS,
  SEVERITY_PENALTY_BPS,
} from '../config/constants.js';
import { validationError } from '../errors.js';
import type { Finding } from '../shared.js';
import type { ScoreReconciliation } from './types.js';

const clampScore = (score: number): number =>
  Math.max(MIN_SCORE_BPS, Math.min(MAX_SCORE_BPS, Math.round(score)));

/**
 * Rule-based score in bps: start at 10000 and subtract a fixed penalty per
 * finding by severity. A single `critical` finding forces a 0 (hard fail).
 * Pure and total — deterministic for a given finding set.
 */
export const computeRuleScore = (findings: readonly Finding[]): number => {
  let score = MAX_SCORE_BPS;
  for (const finding of findings) {
    const penalty = SEVERITY_PENALTY_BPS[finding.severity];
    if (penalty >= MAX_SCORE_BPS) return MIN_SCORE_BPS;
    score -= penalty;
  }
  return clampScore(score);
};

/**
 * Validate a model-proposed score. Must be a finite integer within [0, 10000].
 * Throws VALIDATION_ERROR otherwise (fail fast, never coerce silently).
 */
export const assertValidModelScore = (score: number): number => {
  if (!Number.isFinite(score) || !Number.isInteger(score)) {
    throw validationError('Model score must be an integer', { score });
  }
  if (score < MIN_SCORE_BPS || score > MAX_SCORE_BPS) {
    throw validationError(`Model score must be within [0, ${MAX_SCORE_BPS}]`, {
      score,
    });
  }
  return score;
};

/**
 * Reconcile the model score with the rule score by taking the stricter (lower)
 * value, then decide pass/fail against the threshold.
 */
export const reconcileScore = (
  modelScore: number,
  findings: readonly Finding[],
  threshold: number,
): ScoreReconciliation => {
  const validModelScore = assertValidModelScore(modelScore);
  const ruleScore = computeRuleScore(findings);
  const finalScore = Math.min(validModelScore, ruleScore);
  const source: 'model' | 'rules' =
    validModelScore <= ruleScore ? 'model' : 'rules';
  return {
    finalScore,
    ruleScore,
    modelScore: validModelScore,
    source,
    passed: finalScore >= threshold,
    threshold,
  };
};
