/**
 * Weight cross-check pack.
 *
 * A weight certificate is the independent statement of how much mass shipped.
 * It must be positive, present a value, and agree with the packing list. A
 * weight that disagrees between the certificate and the packing list is a
 * short-shipment / substitution signal. Rules fire only when a
 * `weight_certificate` is present.
 *
 * Note: the base field schema exposes a single numeric `quantity`; for weight
 * documents that value carries the certified mass/unit count, which is what the
 * packing list and certificate are compared on.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { docsOfType, firstOfType } from './util.js';
import type { CrossCheckInput } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** A certified weight value must be strictly positive. */
const ruleNonPositiveWeight = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const cert of docsOfType(input.documents, 'weight_certificate')) {
    const w = cert.fields.quantity;
    if (w === undefined) continue;
    if (!(w > 0)) {
      findings.push(
        createFinding(
          'WEIGHT_NONPOSITIVE',
          'medium',
          `Weight certificate ${cert.name} declares a non-positive weight (${w}).`,
          { document: cert.name, weight: w },
        ),
      );
    }
  }
  return findings;
};

/** A weight certificate must actually state a weight value. */
const ruleWeightPresent = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const cert of docsOfType(input.documents, 'weight_certificate')) {
    if (cert.fields.quantity === undefined) {
      findings.push(
        createFinding(
          'WEIGHT_MISSING_VALUE',
          'low',
          `Weight certificate ${cert.name} states no weight value.`,
          { document: cert.name },
        ),
      );
    }
  }
  return findings;
};

/** The certified weight must match the packing-list weight/count. */
const ruleWeightMatchesPackingList = (input: CrossCheckInput): Finding[] => {
  const cert = firstOfType(input.documents, 'weight_certificate');
  const packing = firstOfType(input.documents, 'packing_list');
  const certWeight = cert?.fields.quantity;
  const packWeight = packing?.fields.quantity;
  if (certWeight === undefined || packWeight === undefined) return [];
  if (certWeight !== packWeight) {
    return [
      createFinding(
        'WEIGHT_MISMATCH',
        'medium',
        `Weight certificate value ${certWeight} disagrees with packing-list value ${packWeight}.`,
        { certificateWeight: certWeight, packingListWeight: packWeight },
      ),
    ];
  }
  return [];
};

export const WEIGHT_CHECKS: readonly CrossCheck[] = [
  {
    code: 'weight.nonpositive',
    domain: 'weight',
    description: 'A certified weight must be strictly positive.',
    run: ruleNonPositiveWeight,
  },
  {
    code: 'weight.present',
    domain: 'weight',
    description: 'A weight certificate must state a weight value.',
    run: ruleWeightPresent,
  },
  {
    code: 'weight.matches_packing_list',
    domain: 'weight',
    description: 'Certified weight must match the packing-list value.',
    run: ruleWeightMatchesPackingList,
  },
];

registerChecks(WEIGHT_CHECKS);
