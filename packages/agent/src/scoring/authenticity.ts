/**
 * Authenticity dimension.
 *
 * How genuine are the documents and how firmly do they tie to the on-chain
 * anchor? Penalises the finding codes that indicate forgery or a broken anchor:
 * an origin-hash mismatch (document does not match the on-chain origin), an
 * unknown/unregistered batch, and the absence of any document to authenticate.
 * Any critical finding hard-fails the dimension to zero.
 */
import { registerScorer } from './registry.js';
import { byCodes, detailOf, scoreByDeduction } from './util.js';
import type { Finding } from '../shared.js';

const AUTHENTICITY_CODES = new Set([
  'ORIGIN_HASH_MISMATCH',
  'UNKNOWN_BATCH',
  'NO_DOCUMENTS',
]);

const isAuthenticityFinding = (finding: Finding): boolean =>
  byCodes(AUTHENTICITY_CODES)(finding) || finding.severity === 'critical';

export const authenticityScorer = registerScorer({
  dimension: 'authenticity',
  description:
    'Document genuineness and on-chain anchoring (origin-hash, batch registration).',
  weight: 1,
  score: (ctx) => {
    const { score, reasons } = scoreByDeduction(
      ctx.findings,
      isAuthenticityFinding,
    );
    return {
      dimension: 'authenticity',
      score,
      detail: detailOf('authenticity', reasons),
    };
  },
});
