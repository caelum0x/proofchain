/**
 * Credit / financing-default risk lens.
 *
 * Advisory input for the financing-eligibility flow: how likely is a lender to
 * lose money if this shipment is financed? Deterministic heuristic over three
 * grounded signals — the severity of trade findings (mispriced/mismatched
 * paperwork erodes recoverability), the SIZE of the exposure (more money at
 * stake amplifies loss), and provenance depth (a thin trail is harder to
 * enforce against). A weak model score is treated as an additional signal.
 */
import { DEFAULT_PASS_THRESHOLD_BPS } from '../config/constants.js';
import { registerRiskModel, riskLevel } from './registry.js';
import type { RiskContext } from './registry.js';
import { clampRiskBps, tradeExposure, weightedSeverity } from './util.js';

/** Exposure (in document currency units) above which a premium is charged. */
const HIGH_EXPOSURE = 100_000;
const EXPOSURE_PREMIUM_BPS = 1_500;
const THIN_PROVENANCE_BPS = 800;
const LOW_MODEL_BPS = 1_200;

export const creditRiskModel = registerRiskModel({
  id: 'credit',
  description:
    'Financing/credit-default risk from finding severity, exposure size and provenance depth.',
  assess: (ctx: RiskContext) => {
    const { bps, factors: severityFactors } = weightedSeverity(ctx.findings);
    const factors = [...severityFactors];
    let score = bps;

    const exposure = tradeExposure(ctx.documents);
    if (exposure >= HIGH_EXPOSURE) {
      score += EXPOSURE_PREMIUM_BPS;
      factors.push(`high_exposure(${exposure})`);
    }

    if (!ctx.provenance.exists || ctx.provenance.checkpoints.length === 0) {
      score += THIN_PROVENANCE_BPS;
      factors.push('thin_provenance');
    }

    if (ctx.modelScore < DEFAULT_PASS_THRESHOLD_BPS) {
      score += LOW_MODEL_BPS;
      factors.push(`sub_threshold_model_score(${ctx.modelScore})`);
    }

    const bounded = clampRiskBps(score);
    return {
      model: 'credit',
      score: bounded,
      level: riskLevel(bounded),
      factors,
    };
  },
});
