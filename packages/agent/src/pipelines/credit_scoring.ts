/**
 * Credit-scoring pipeline.
 *
 * Produces a counterparty credit score for the batch's supplier by blending
 * three signals: verification integrity (the reconciled score), the inverse of
 * the counterparty/credit risk lens, and — when supplied — the supplier's
 * historical delivery performance. The basis-point blend maps to both a classic
 * 300–850 score and a letter rating, plus an estimated probability of default.
 */
import { runAssessment, type AssessmentDeps, type AssessmentRequest } from './assessment.js';
import { registerPipeline } from './registry.js';
import {
  clampBps,
  creditRating,
  weightedBps,
  worstRiskScore,
  type CreditRating,
} from './decision.js';
import { MAX_SCORE_BPS } from '../config/constants.js';
import type { Finding } from '../shared.js';
import type { Hex } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

/** Classic FICO-style score band. */
const SCORE_FLOOR = 300;
const SCORE_RANGE = 550; // 300..850

export interface CreditHistory {
  readonly totalDeliveries?: number;
  readonly onTimeDeliveries?: number;
  readonly defaults?: number;
}

export interface CreditRequest extends AssessmentRequest {
  readonly history?: CreditHistory;
}

export interface CreditResult {
  readonly batchId: Hex;
  /** Blended creditworthiness in basis points (0..10000). */
  readonly scoreBps: number;
  /** Classic 300–850 credit score. */
  readonly creditScore: number;
  readonly rating: CreditRating;
  /** Estimated probability of default in basis points. */
  readonly pdBps: number;
  readonly factors: string[];
  readonly reasons: string[];
  readonly findings: Finding[];
  readonly risk: RiskAssessment[];
}

/** Map delivery history to a 0..10000 performance score, or undefined. */
const historyToBps = (
  history: CreditHistory | undefined,
): { bps: number; note: string } | undefined => {
  if (history === undefined) return undefined;
  const total = history.totalDeliveries ?? 0;
  if (total <= 0) return undefined;
  const onTime = Math.max(0, Math.min(total, history.onTimeDeliveries ?? 0));
  const defaults = Math.max(0, history.defaults ?? 0);
  const onTimeRatio = onTime / total;
  const defaultRatio = Math.min(1, defaults / total);
  const bps = clampBps((onTimeRatio - defaultRatio) * MAX_SCORE_BPS);
  return {
    bps,
    note: `history: ${onTime}/${total} on-time, ${defaults} default(s)`,
  };
};

export const runCreditScoring = async (
  deps: AssessmentDeps,
  req: CreditRequest,
): Promise<CreditResult> => {
  const a = await runAssessment(deps, req);

  const integrityBps = a.reconciliation.finalScore;
  const creditRiskBps = worstRiskScore(a.risk, 'credit', 'counterparty', 'fraud');
  const riskQualityBps = clampBps(MAX_SCORE_BPS - creditRiskBps);
  const history = historyToBps(req.history);

  // Weighted blend; the history weight is only active when history is supplied.
  const scoreBps = weightedBps([
    [integrityBps, 0.5],
    [riskQualityBps, 0.3],
    [history?.bps ?? 0, history !== undefined ? 0.2 : 0],
  ]);

  const creditScore = Math.round(SCORE_FLOOR + (scoreBps / MAX_SCORE_BPS) * SCORE_RANGE);
  const rating = creditRating(scoreBps);
  const pdBps = clampBps((MAX_SCORE_BPS - scoreBps) / 2);

  const factors = [
    `integrity=${integrityBps}`,
    `risk_quality=${riskQualityBps}`,
    ...(history !== undefined ? [history.note] : []),
  ];

  return {
    batchId: a.batchId,
    scoreBps,
    creditScore,
    rating,
    pdBps,
    factors,
    reasons: [
      `Credit ${creditScore} (${rating}), ${scoreBps} bps, PD ${pdBps} bps.`,
    ],
    findings: a.findings,
    risk: a.risk,
  };
};

export const CREDIT_SCORING_PIPELINE = registerPipeline<
  AssessmentDeps,
  CreditRequest,
  CreditResult
>({
  id: 'credit_scoring',
  description:
    'Counterparty credit score: blends verification integrity, credit-risk ' +
    'lens and delivery history into a 300–850 score, rating and PD estimate.',
  run: runCreditScoring,
});
