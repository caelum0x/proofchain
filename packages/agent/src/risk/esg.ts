/**
 * ESG (environmental / social / governance) risk lens.
 *
 * Feeds the insurance-underwriting and compliance flows with a sustainability
 * risk read. Because ESG claims are only credible when they are traceable and
 * anchored, risk rises when there is no ESG disclosure (empty metadata URI),
 * when the traceability trail is too sparse to substantiate sourcing claims,
 * and when governance integrity breaks (an origin-hash mismatch or any
 * critical finding — a document that does not tie to its on-chain anchor).
 */
import { registerRiskModel, riskLevel } from './registry.js';
import type { RiskContext } from './registry.js';
import { clampRiskBps, countByCode, hasCritical } from './util.js';

const GOVERNANCE_CODES = new Set(['ORIGIN_HASH_MISMATCH']);

const NO_DISCLOSURE_BPS = 2_000;
const SPARSE_TRACE_BPS = 1_500;
const NO_TRACE_BPS = 3_000;
const GOVERNANCE_BPS = 3_000;
const CRITICAL_BPS = 2_000;

const SPARSE_CHECKPOINT_THRESHOLD = 2;

export const esgRiskModel = registerRiskModel({
  id: 'esg',
  description:
    'ESG risk from disclosure completeness, traceability depth and governance integrity.',
  assess: (ctx: RiskContext) => {
    const factors: string[] = [];
    let score = 0;

    if (ctx.provenance.metadataURI.trim().length === 0) {
      score += NO_DISCLOSURE_BPS;
      factors.push('no_esg_disclosure');
    }

    const checkpoints = ctx.provenance.checkpoints.length;
    if (checkpoints === 0) {
      score += NO_TRACE_BPS;
      factors.push('no_traceability');
    } else if (checkpoints < SPARSE_CHECKPOINT_THRESHOLD) {
      score += SPARSE_TRACE_BPS;
      factors.push('sparse_traceability');
    }

    if (countByCode(ctx.findings, GOVERNANCE_CODES) > 0) {
      score += GOVERNANCE_BPS;
      factors.push('governance_anchor_break');
    }
    if (hasCritical(ctx.findings)) {
      score += CRITICAL_BPS;
      factors.push('critical_finding');
    }

    const bounded = clampRiskBps(score);
    return {
      model: 'esg',
      score: bounded,
      level: riskLevel(bounded),
      factors,
    };
  },
});
