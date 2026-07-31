/**
 * Fraud risk model. A deterministic heuristic over the finding set: document
 * fraud correlates strongly with provenance/consistency breaks, so severity is
 * weighted heavily and a critical finding pins risk to the top of the band.
 */
import { SEVERITY_RANK } from '../config/constants.js';
import { registerRiskModel, riskLevel } from './registry.js';
import type { RiskContext } from './registry.js';

/** Basis-point risk contribution per finding severity. */
const SEVERITY_RISK_BPS: Record<string, number> = {
  info: 0,
  low: 400,
  medium: 1_200,
  high: 3_000,
  critical: 10_000,
};

export const fraudRiskModel = registerRiskModel({
  id: 'fraud',
  description:
    'Document-fraud likelihood derived from cross-check finding severities.',
  assess: (ctx: RiskContext) => {
    const factors: string[] = [];
    let score = 0;
    for (const finding of ctx.findings) {
      const add = SEVERITY_RISK_BPS[finding.severity] ?? 0;
      if (add > 0) {
        score += add;
        factors.push(`${finding.code} (${finding.severity})`);
      }
      // Any critical finding dominates: cap immediately.
      if (SEVERITY_RANK[finding.severity] === SEVERITY_RANK.critical) {
        score = 10_000;
      }
    }
    // A very low model score is itself a fraud signal.
    if (ctx.modelScore < 3_000) {
      score += 1_500;
      factors.push(`low_model_score(${ctx.modelScore})`);
    }
    const bounded = Math.max(0, Math.min(10_000, score));
    return {
      model: 'fraud',
      score: bounded,
      level: riskLevel(bounded),
      factors,
    };
  },
});
