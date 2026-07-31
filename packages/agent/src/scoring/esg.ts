/**
 * ESG dimension.
 *
 * Sustainability/traceability cleanliness. A credible ESG claim needs an anchor
 * (on-chain metadata disclosure) and a substantiating trail (checkpoints), so
 * this dimension deducts for a missing disclosure and for a sparse/absent
 * traceability trail, then applies severity deductions to ESG-flavoured finding
 * codes emitted by Fill rule packs (cold-chain, emissions, labour). A critical
 * finding hard-fails the dimension.
 */
import { MAX_SCORE_BPS } from '../config/constants.js';
import { registerScorer } from './registry.js';
import { DIMENSION_DEDUCTION_BPS, byPrefixes, detailOf } from './util.js';
import type { ScoringContext } from './registry.js';

const ESG_PREFIXES = [
  'COLD_CHAIN',
  'ESG',
  'EMISSION',
  'CARBON',
  'LABOR',
  'WORKER',
  'RECYCL',
] as const;

const NO_DISCLOSURE_BPS = 2_500;
const NO_TRACE_BPS = 3_000;
const SPARSE_TRACE_BPS = 1_500;
const SPARSE_CHECKPOINT_THRESHOLD = 2;

const isEsgFinding = byPrefixes(ESG_PREFIXES);

const evaluateEsg = (
  ctx: ScoringContext,
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  let score = MAX_SCORE_BPS;

  if (ctx.provenance.metadataURI.trim().length === 0) {
    score -= NO_DISCLOSURE_BPS;
    reasons.push('no_esg_disclosure');
  }

  const checkpoints = ctx.provenance.checkpoints.length;
  if (checkpoints === 0) {
    score -= NO_TRACE_BPS;
    reasons.push('no_traceability');
  } else if (checkpoints < SPARSE_CHECKPOINT_THRESHOLD) {
    score -= SPARSE_TRACE_BPS;
    reasons.push('sparse_traceability');
  }

  for (const finding of ctx.findings) {
    if (finding.severity === 'critical') {
      reasons.push(`${finding.code}=critical`);
      return { score: 0, reasons };
    }
    if (!isEsgFinding(finding)) continue;
    const deduction = DIMENSION_DEDUCTION_BPS[finding.severity];
    if (deduction <= 0) continue;
    score -= deduction;
    reasons.push(`${finding.code}(-${deduction})`);
  }

  return { score: Math.max(0, score), reasons };
};

export const esgScorer = registerScorer({
  dimension: 'esg',
  description:
    'ESG/sustainability cleanliness from disclosure, traceability depth and ESG findings.',
  weight: 1,
  score: (ctx) => {
    const { score, reasons } = evaluateEsg(ctx);
    return { dimension: 'esg', score, detail: detailOf('esg', reasons) };
  },
});
