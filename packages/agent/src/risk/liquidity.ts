/**
 * Liquidity / settlement risk lens.
 *
 * How likely is settlement to STALL, leaving escrowed funds locked? The escrow
 * only releases on a passing, unblocked verdict, so liquidity risk rises as the
 * model score falls below the pass threshold (the verdict may not clear),
 * as high/critical findings accumulate (each can block release), and when the
 * shipment cannot be valued (no invoice total → nothing to settle against).
 */
import { DEFAULT_PASS_THRESHOLD_BPS } from '../config/constants.js';
import { registerRiskModel, riskLevel } from './registry.js';
import type { RiskContext } from './registry.js';
import { clampRiskBps, tradeExposure, weightedSeverity } from './util.js';

/** Fraction of the sub-threshold score gap converted into liquidity risk. */
const THRESHOLD_GAP_FACTOR = 0.6;
const MISSING_VALUATION_BPS = 1_500;

const isBlocking = (severity: string): boolean =>
  severity === 'high' || severity === 'critical';

export const liquidityRiskModel = registerRiskModel({
  id: 'liquidity',
  description:
    'Settlement/liquidity risk from pass-threshold proximity, blocking findings and valuability.',
  assess: (ctx: RiskContext) => {
    const factors: string[] = [];
    let score = 0;

    if (ctx.modelScore < DEFAULT_PASS_THRESHOLD_BPS) {
      const gap = DEFAULT_PASS_THRESHOLD_BPS - ctx.modelScore;
      score += gap * THRESHOLD_GAP_FACTOR;
      factors.push(`below_pass_threshold(gap=${gap})`);
    }

    const { bps, factors: blockingFactors } = weightedSeverity(
      ctx.findings,
      (finding) => isBlocking(finding.severity),
    );
    if (bps > 0) {
      score += bps;
      factors.push(...blockingFactors);
    }

    if (ctx.documents.length > 0 && tradeExposure(ctx.documents) === 0) {
      score += MISSING_VALUATION_BPS;
      factors.push('unvaluable_no_invoice_total');
    }

    const bounded = clampRiskBps(score);
    return {
      model: 'liquidity',
      score: bounded,
      level: riskLevel(bounded),
      factors,
    };
  },
});
