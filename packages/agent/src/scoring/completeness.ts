/**
 * Completeness dimension.
 *
 * Structural sufficiency of the evidence package, independent of whether the
 * evidence is CORRECT (that is authenticity/consistency). Inspects the context
 * directly: no documents at all is a hard zero; a batch that is not registered
 * on-chain, an empty checkpoint trail, and invoices missing a total or line
 * items each deduct. Deterministic and total — pure over its inputs.
 */
import { MAX_SCORE_BPS } from '../config/constants.js';
import { registerScorer } from './registry.js';
import { detailOf } from './util.js';
import type { ScoringContext } from './registry.js';

const BATCH_UNREGISTERED_BPS = 4_000;
const NO_CHECKPOINTS_BPS = 2_000;
const INVOICE_FIELD_BPS = 1_500;

const clampToFloor = (n: number): number => Math.max(0, n);

const evaluateCompleteness = (
  ctx: ScoringContext,
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];

  if (ctx.documents.length === 0) {
    return { score: 0, reasons: ['no_documents'] };
  }

  let score = MAX_SCORE_BPS;

  if (!ctx.provenance.exists) {
    score -= BATCH_UNREGISTERED_BPS;
    reasons.push('batch_unregistered');
  }
  if (ctx.provenance.checkpoints.length === 0) {
    score -= NO_CHECKPOINTS_BPS;
    reasons.push('no_checkpoints');
  }

  for (const doc of ctx.documents) {
    if (doc.docType !== 'invoice') continue;
    const { total, lineItems } = doc.fields;
    const missingTotal = typeof total !== 'number';
    const missingLineItems = lineItems === undefined || lineItems.length === 0;
    if (missingTotal || missingLineItems) {
      score -= INVOICE_FIELD_BPS;
      reasons.push(`incomplete_invoice(${doc.name})`);
    }
  }

  return { score: clampToFloor(score), reasons };
};

export const completenessScorer = registerScorer({
  dimension: 'completeness',
  description:
    'Structural sufficiency of the evidence package (documents, checkpoints, required invoice fields).',
  weight: 1,
  score: (ctx) => {
    const { score, reasons } = evaluateCompleteness(ctx);
    return {
      dimension: 'completeness',
      score,
      detail: detailOf('completeness', reasons),
    };
  },
});
