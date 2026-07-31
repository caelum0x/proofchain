/**
 * Compliance dimension.
 *
 * Regulatory cleanliness — sanctions, customs, export-control, AML and product
 * certification. The base engine emits no compliance findings, so a batch with
 * none scores clean; Fill check packs (sanctions/customs rule packs) emit codes
 * under known prefixes which this dimension penalises. A critical compliance
 * breach (e.g. a sanctions hit) hard-fails the dimension to zero.
 */
import { registerScorer } from './registry.js';
import { byPrefixes, detailOf, scoreByDeduction } from './util.js';
import type { Finding } from '../shared.js';

/** Code prefixes emitted by compliance rule packs. */
const COMPLIANCE_PREFIXES = [
  'SANCTION',
  'AML',
  'CUSTOMS',
  'EXPORT',
  'LICENSE',
  'HALAL',
  'PHYTO',
  'RECALL',
  'DUTY',
  'TARIFF',
  'COMPLIANCE',
] as const;

const isComplianceFinding = (finding: Finding): boolean =>
  byPrefixes(COMPLIANCE_PREFIXES)(finding) || finding.severity === 'critical';

export const complianceScorer = registerScorer({
  dimension: 'compliance',
  description:
    'Regulatory cleanliness across sanctions, customs, export-control, AML and certification.',
  weight: 1,
  score: (ctx) => {
    const { score, reasons } = scoreByDeduction(
      ctx.findings,
      isComplianceFinding,
    );
    return {
      dimension: 'compliance',
      score,
      detail: detailOf('compliance', reasons),
    };
  },
});
