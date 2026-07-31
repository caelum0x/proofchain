/**
 * Digital Product Passport (DPP) completeness cross-check pack.
 *
 * The EU DPP requires a product to ship with a complete, verifiable dossier: a
 * data carrier (the on-chain metadata URI), a lifecycle trail (checkpoints), a
 * commercial record, and a named economic operator. This pack activates when a
 * compliance dossier is being presented — signalled by a `certificate_of_origin`
 * or an explicit passport document — and then asserts the dossier is complete.
 *
 * Activation gating keeps a plain commercial shipment (invoice only) silent.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { hasType } from './util.js';
import type { CrossCheckInput, ParsedDocument } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** Doc types that signal a DPP / compliance dossier is being assembled. */
const DOSSIER_SIGNAL_TYPES = [
  'certificate_of_origin',
  'digital_product_passport',
  'dpp',
] as const;

const isDppDossier = (docs: readonly ParsedDocument[]): boolean =>
  DOSSIER_SIGNAL_TYPES.some((t) => hasType(docs, t));

const namesOperator = (doc: ParsedDocument): boolean =>
  (doc.fields.supplierName?.trim().length ?? 0) > 0 ||
  (doc.fields.buyerName?.trim().length ?? 0) > 0 ||
  (doc.fields.parties?.length ?? 0) > 0;

/** The data carrier (on-chain metadata URI) must be present. */
const ruleDataCarrier = (input: CrossCheckInput): Finding[] => {
  if (!isDppDossier(input.documents)) return [];
  if (input.provenance.metadataURI.trim().length === 0) {
    return [
      createFinding(
        'DPP_MISSING_DATA_CARRIER',
        'high',
        'Digital Product Passport dossier has no on-chain data-carrier (metadata URI).',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  return [];
};

/** A complete passport must include a commercial record (invoice). */
const ruleCommercialRecord = (input: CrossCheckInput): Finding[] => {
  if (!isDppDossier(input.documents)) return [];
  if (!hasType(input.documents, 'invoice')) {
    return [
      createFinding(
        'DPP_MISSING_COMMERCIAL_RECORD',
        'medium',
        'Digital Product Passport dossier includes no commercial invoice.',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  return [];
};

/** A complete passport must carry a lifecycle trail (checkpoints). */
const ruleLifecycleTrail = (input: CrossCheckInput): Finding[] => {
  if (!isDppDossier(input.documents)) return [];
  if (input.provenance.checkpoints.length === 0) {
    return [
      createFinding(
        'DPP_MISSING_LIFECYCLE',
        'medium',
        'Digital Product Passport dossier has no lifecycle checkpoints.',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  return [];
};

/** A complete passport must name at least one economic operator. */
const ruleEconomicOperator = (input: CrossCheckInput): Finding[] => {
  if (!isDppDossier(input.documents)) return [];
  if (!input.documents.some(namesOperator)) {
    return [
      createFinding(
        'DPP_MISSING_ECONOMIC_OPERATOR',
        'medium',
        'Digital Product Passport dossier names no economic operator (supplier/buyer).',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  return [];
};

export const DPP_COMPLETENESS_CHECKS: readonly CrossCheck[] = [
  {
    code: 'dpp_completeness.data_carrier',
    domain: 'dpp_completeness',
    description: 'A DPP dossier must carry an on-chain data-carrier URI.',
    run: ruleDataCarrier,
  },
  {
    code: 'dpp_completeness.commercial_record',
    domain: 'dpp_completeness',
    description: 'A DPP dossier must include a commercial invoice.',
    run: ruleCommercialRecord,
  },
  {
    code: 'dpp_completeness.lifecycle_trail',
    domain: 'dpp_completeness',
    description: 'A DPP dossier must carry a lifecycle checkpoint trail.',
    run: ruleLifecycleTrail,
  },
  {
    code: 'dpp_completeness.economic_operator',
    domain: 'dpp_completeness',
    description: 'A DPP dossier must name an economic operator.',
    run: ruleEconomicOperator,
  },
];

registerChecks(DPP_COMPLETENESS_CHECKS);
