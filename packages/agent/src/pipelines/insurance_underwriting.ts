/**
 * Insurance-underwriting pipeline.
 *
 * Prices cargo / parametric / trade-credit cover for a batch. Insurability is
 * gated on provenance integrity (no critical findings, batch known on-chain);
 * the premium rate is a base rate for the cover type loaded by the batch's risk
 * profile and outstanding findings, and higher risk raises the deductible.
 */
import { runAssessment, type AssessmentDeps, type AssessmentRequest } from './assessment.js';
import { registerPipeline } from './registry.js';
import {
  clampBps,
  countAtLeast,
  defectMessages,
  hasCritical,
  worstRiskScore,
} from './decision.js';
import type { Finding } from '../shared.js';
import type { Hex } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

export type CoverageType = 'cargo' | 'parametric' | 'credit';

/** Base premium rate (bps of the coverage amount) per cover type. */
const BASE_PREMIUM_BPS: Record<CoverageType, number> = {
  cargo: 150,
  parametric: 250,
  credit: 400,
};

/** Fraction of the risk score added to the premium rate. */
const RISK_LOAD = 0.05;
/** Additional premium bps per finding at/above `high`. */
const FINDING_LOAD_BPS = 120;
/** Premium rate ceiling (bps). */
const MAX_PREMIUM_BPS = 5_000;
/** Base deductible (bps) plus a fraction of the risk score. */
const BASE_DEDUCTIBLE_BPS = 500;
const DEDUCTIBLE_RISK_LOAD = 0.1;

export interface InsuranceRequest extends AssessmentRequest {
  /** Sum insured, in the invoice currency's unit. */
  readonly coverageAmount: number;
  readonly coverageType?: CoverageType;
}

export interface InsuranceResult {
  readonly batchId: Hex;
  readonly insurable: boolean;
  readonly coverageType: CoverageType;
  readonly coverageAmount: number;
  readonly score: number;
  readonly premiumRateBps: number;
  readonly premiumAmount: number;
  readonly deductibleBps: number;
  readonly exclusions: string[];
  readonly reasons: string[];
  readonly findings: Finding[];
  readonly risk: RiskAssessment[];
}

export const runInsuranceUnderwriting = async (
  deps: AssessmentDeps,
  req: InsuranceRequest,
): Promise<InsuranceResult> => {
  const a = await runAssessment(deps, req);
  const coverageType: CoverageType = req.coverageType ?? 'cargo';
  const coverage = Math.max(0, req.coverageAmount);
  const riskBps = worstRiskScore(a.risk, 'route', 'fraud', 'esg');

  const reasons: string[] = [];
  let insurable = true;

  if (!a.provenance.exists) {
    insurable = false;
    reasons.push('Batch is not registered on-chain; cover cannot be bound.');
  }
  if (hasCritical(a.findings)) {
    insurable = false;
    reasons.push('A critical finding makes the shipment uninsurable.');
  }
  if (coverage <= 0) {
    insurable = false;
    reasons.push('Coverage amount must be greater than zero.');
  }

  const highFindings = countAtLeast(a.findings, 'high');
  const premiumRateBps = Math.min(
    MAX_PREMIUM_BPS,
    clampBps(
      BASE_PREMIUM_BPS[coverageType] +
        riskBps * RISK_LOAD +
        highFindings * FINDING_LOAD_BPS,
    ),
  );
  const premiumAmount = insurable ? (coverage * premiumRateBps) / 10_000 : 0;
  const deductibleBps = clampBps(
    BASE_DEDUCTIBLE_BPS + riskBps * DEDUCTIBLE_RISK_LOAD,
  );

  // Exclusions: every high+ finding becomes a named exclusion on the policy.
  const exclusions = defectMessages(a.findings, 'high');

  if (insurable) {
    reasons.push(
      `Insurable: ${coverageType} cover at ${premiumRateBps} bps (premium ${premiumAmount}).`,
    );
  }

  return {
    batchId: a.batchId,
    insurable,
    coverageType,
    coverageAmount: coverage,
    score: a.reconciliation.finalScore,
    premiumRateBps,
    premiumAmount,
    deductibleBps,
    exclusions,
    reasons,
    findings: a.findings,
    risk: a.risk,
  };
};

export const INSURANCE_UNDERWRITING_PIPELINE = registerPipeline<
  AssessmentDeps,
  InsuranceRequest,
  InsuranceResult
>({
  id: 'insurance_underwriting',
  description:
    'Cargo / parametric / trade-credit underwriting: insurability gate plus ' +
    'risk-loaded premium rate, premium and deductible.',
  run: runInsuranceUnderwriting,
});
