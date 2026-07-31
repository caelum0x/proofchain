/**
 * Financing-eligibility pipeline.
 *
 * Decides whether a verified batch qualifies for trade finance (invoice
 * factoring / PO financing) and, if so, the advance rate and maximum advance.
 * Real trade-finance policy: finance can only move on VERIFIED goods, so a
 * failed verification or any critical finding blocks eligibility outright, and
 * the advance rate is scaled by the reconciled verification score and dampened
 * by counterparty/credit risk.
 */
import { runAssessment, type AssessmentDeps, type AssessmentRequest } from './assessment.js';
import { registerPipeline } from './registry.js';
import {
  clampBps,
  hasCritical,
  invoiceValue,
  worstRiskScore,
} from './decision.js';
import type { Finding } from '../shared.js';
import type { Hex } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

/** Maximum advance rate the desk will ever extend, in basis points (90%). */
const MAX_ADVANCE_BPS = 9_000;
/** Fraction of the counterparty risk score subtracted from the advance rate. */
const RISK_DAMPENING = 0.3;

export interface FinancingRequest extends AssessmentRequest {
  /** Amount requested, in the same unit as the invoice total(s). */
  readonly requestedAmount?: number;
  readonly currency?: string;
}

export interface FinancingResult {
  readonly batchId: Hex;
  readonly eligible: boolean;
  /** Reconciled verification score (bps). */
  readonly score: number;
  /** Advance rate offered as a fraction of invoice value (bps). */
  readonly advanceRateBps: number;
  readonly invoiceValue: number;
  /** invoiceValue × advanceRate. */
  readonly maxAdvanceAmount: number;
  /** min(requestedAmount, maxAdvanceAmount) when eligible, else 0. */
  readonly approvedAmount: number;
  readonly currency?: string;
  /** Counterparty/credit risk driving the advance dampening (bps). */
  readonly creditRiskBps: number;
  readonly reasons: string[];
  readonly findings: Finding[];
  readonly risk: RiskAssessment[];
}

export const runFinancingEligibility = async (
  deps: AssessmentDeps,
  req: FinancingRequest,
): Promise<FinancingResult> => {
  const a = await runAssessment(deps, req);
  const score = a.reconciliation.finalScore;
  const value = invoiceValue(a.documents);
  const creditRiskBps = worstRiskScore(a.risk, 'credit', 'counterparty');

  const reasons: string[] = [];
  let eligible = true;

  if (!a.reconciliation.passed) {
    eligible = false;
    reasons.push(
      `Verification score ${score} is below the pass threshold ${a.reconciliation.threshold}.`,
    );
  }
  if (hasCritical(a.findings)) {
    eligible = false;
    reasons.push('A critical verification finding blocks financing.');
  }
  if (value <= 0) {
    eligible = false;
    reasons.push('No invoice value could be established from the documents.');
  }

  // Advance rate: scaled by verification score, dampened by credit risk.
  const scaled = (MAX_ADVANCE_BPS * score) / 10_000;
  const advanceRateBps = eligible
    ? clampBps(scaled - creditRiskBps * RISK_DAMPENING)
    : 0;
  const maxAdvanceAmount = (value * advanceRateBps) / 10_000;
  const approvedAmount = eligible
    ? req.requestedAmount !== undefined
      ? Math.min(req.requestedAmount, maxAdvanceAmount)
      : maxAdvanceAmount
    : 0;

  if (eligible) {
    reasons.push(
      `Eligible: advance rate ${advanceRateBps} bps on invoice value ${value}.`,
    );
  }

  return {
    batchId: a.batchId,
    eligible,
    score,
    advanceRateBps,
    invoiceValue: value,
    maxAdvanceAmount,
    approvedAmount,
    ...(req.currency !== undefined ? { currency: req.currency } : {}),
    creditRiskBps,
    reasons,
    findings: a.findings,
    risk: a.risk,
  };
};

export const FINANCING_ELIGIBILITY_PIPELINE = registerPipeline<
  AssessmentDeps,
  FinancingRequest,
  FinancingResult
>({
  id: 'financing_eligibility',
  description:
    'Trade-finance eligibility: verification-gated advance-rate and maximum ' +
    'advance for invoice factoring / PO financing.',
  run: runFinancingEligibility,
});
