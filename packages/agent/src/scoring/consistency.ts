/**
 * Consistency dimension.
 *
 * Do the documents and the on-chain trail agree with THEMSELVES and each other?
 * Penalises the internal-agreement finding codes: invoice totals that do not
 * foot, line-item arithmetic errors, quantities that disagree across documents,
 * conflicting party names, dates that predate registration, and out-of-order
 * checkpoints. A critical finding hard-fails the dimension.
 */
import { registerScorer } from './registry.js';
import { byCodes, detailOf, scoreByDeduction } from './util.js';
import type { Finding } from '../shared.js';

const CONSISTENCY_CODES = new Set([
  'INVOICE_TOTAL_MISMATCH',
  'LINE_ITEM_AMOUNT_MISMATCH',
  'QUANTITY_MISMATCH',
  'SUPPLIER_MISMATCH',
  'DATE_INCONSISTENCY',
  'CHECKPOINT_ORDER',
]);

const isConsistencyFinding = (finding: Finding): boolean =>
  byCodes(CONSISTENCY_CODES)(finding) || finding.severity === 'critical';

export const consistencyScorer = registerScorer({
  dimension: 'consistency',
  description:
    'Internal agreement across documents and the on-chain trail (totals, quantities, parties, dates).',
  weight: 1,
  score: (ctx) => {
    const { score, reasons } = scoreByDeduction(
      ctx.findings,
      isConsistencyFinding,
    );
    return {
      dimension: 'consistency',
      score,
      detail: detailOf('consistency', reasons),
    };
  },
});
