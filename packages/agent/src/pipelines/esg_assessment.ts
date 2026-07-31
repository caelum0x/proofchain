/**
 * ESG-assessment pipeline.
 *
 * Produces Environmental / Social / Governance sub-scores and an overall ESG
 * rating for a batch. Governance is anchored on verification integrity (a clean,
 * well-provenanced batch is well-governed); Environmental and Social default to
 * the batch's ESG risk lens and any caller-supplied E/S factors. All inputs are
 * optional so the flow is fully deterministic and offline-runnable.
 */
import { runAssessment, type AssessmentDeps, type AssessmentRequest } from './assessment.js';
import { registerPipeline } from './registry.js';
import {
  clampBps,
  countAtLeast,
  defectMessages,
  esgRating,
  unitToBps,
  worstRiskScore,
  type EsgRating,
} from './decision.js';
import { MAX_SCORE_BPS } from '../config/constants.js';
import type { Finding } from '../shared.js';
import type { Hex } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

/** Governance penalty (bps) per finding at/above `high`. */
const GOVERNANCE_PENALTY_BPS = 800;

export interface EsgRequest extends AssessmentRequest {
  /** Environmental factor, normalised 0..1 (1 = best). */
  readonly environmental?: number;
  /** Social factor, normalised 0..1 (1 = best). */
  readonly social?: number;
  /** Governance factor, normalised 0..1 (1 = best); defaults to verification. */
  readonly governance?: number;
}

export interface EsgResult {
  readonly batchId: Hex;
  readonly overallScore: number;
  readonly environmental: number;
  readonly social: number;
  readonly governance: number;
  readonly rating: EsgRating;
  readonly factors: string[];
  readonly reasons: string[];
  readonly findings: Finding[];
  readonly risk: RiskAssessment[];
}

export const runEsgAssessment = async (
  deps: AssessmentDeps,
  req: EsgRequest,
): Promise<EsgResult> => {
  const a = await runAssessment(deps, req);

  // ESG risk (higher = worse) inverts into an ESG-quality baseline.
  const esgRiskBps = worstRiskScore(a.risk, 'esg');
  const esgQualityBps = clampBps(MAX_SCORE_BPS - esgRiskBps);

  const environmental =
    req.environmental !== undefined ? unitToBps(req.environmental) : esgQualityBps;
  const social =
    req.social !== undefined ? unitToBps(req.social) : esgQualityBps;

  const highFindings = countAtLeast(a.findings, 'high');
  const governanceBase =
    req.governance !== undefined
      ? unitToBps(req.governance)
      : a.reconciliation.finalScore;
  const governance = clampBps(
    governanceBase - highFindings * GOVERNANCE_PENALTY_BPS,
  );

  const overallScore = clampBps((environmental + social + governance) / 3);
  const rating = esgRating(overallScore);

  const factors = [
    `environmental=${environmental}`,
    `social=${social}`,
    `governance=${governance}`,
    ...defectMessages(a.findings, 'high'),
  ];

  return {
    batchId: a.batchId,
    overallScore,
    environmental,
    social,
    governance,
    rating,
    factors,
    reasons: [`Overall ESG ${overallScore} bps → rating ${rating}.`],
    findings: a.findings,
    risk: a.risk,
  };
};

export const ESG_ASSESSMENT_PIPELINE = registerPipeline<
  AssessmentDeps,
  EsgRequest,
  EsgResult
>({
  id: 'esg_assessment',
  description:
    'Environmental / Social / Governance sub-scores and overall ESG rating, ' +
    'anchored on verification integrity and the ESG risk lens.',
  run: runEsgAssessment,
});
