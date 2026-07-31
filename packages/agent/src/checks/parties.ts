/**
 * Parties cross-check pack.
 *
 * Counterparty integrity: a document must not name the same entity as both
 * buyer and seller (a classic circular/self-dealing fraud), the buyer must be
 * consistent across the paperwork, and a document's declared `parties[]` list
 * must be internally coherent (no duplicates, and it should include the parties
 * it separately names). The builtin `core.supplier_consistency` rule already
 * covers seller consistency, so this pack does not duplicate it.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { normName } from './util.js';
import type { CrossCheckInput } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** A single document must not name the same party as buyer and supplier. */
const ruleNoSelfDeal = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const supplier = doc.fields.supplierName;
    const buyer = doc.fields.buyerName;
    if (
      supplier === undefined ||
      buyer === undefined ||
      supplier.trim().length === 0 ||
      buyer.trim().length === 0
    ) {
      continue;
    }
    if (normName(supplier) === normName(buyer)) {
      findings.push(
        createFinding(
          'PARTIES_SELF_DEAL',
          'high',
          `Document ${doc.name} names the same entity as both buyer and supplier ("${supplier}").`,
          { document: doc.name, party: supplier },
        ),
      );
    }
  }
  return findings;
};

/** The buyer named must be consistent across documents that declare it. */
const ruleBuyerConsistency = (input: CrossCheckInput): Finding[] => {
  const buyers = new Set(
    input.documents
      .map((d) => d.fields.buyerName)
      .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
      .map(normName),
  );
  if (buyers.size > 1) {
    return [
      createFinding(
        'PARTIES_BUYER_MISMATCH',
        'medium',
        'Documents disagree on the buyer/consignee name.',
        { buyers: [...buyers] },
      ),
    ];
  }
  return [];
};

/** A declared `parties[]` list must not contain duplicate entries. */
const ruleNoDuplicateParties = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const parties = doc.fields.parties;
    if (parties === undefined || parties.length < 2) continue;
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const p of parties) {
      const key = normName(p);
      if (key.length === 0) continue;
      if (seen.has(key)) dupes.add(key);
      seen.add(key);
    }
    if (dupes.size > 0) {
      findings.push(
        createFinding(
          'PARTIES_DUPLICATE',
          'low',
          `Document ${doc.name} lists duplicate parties.`,
          { document: doc.name, duplicates: [...dupes] },
        ),
      );
    }
  }
  return findings;
};

/** A named supplier/buyer should appear in the document's own `parties[]`. */
const ruleNamedPartiesListed = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const parties = doc.fields.parties;
    if (parties === undefined || parties.length === 0) continue;
    const listed = new Set(parties.map(normName));
    for (const [role, value] of [
      ['supplier', doc.fields.supplierName],
      ['buyer', doc.fields.buyerName],
    ] as const) {
      if (value === undefined || value.trim().length === 0) continue;
      if (!listed.has(normName(value))) {
        findings.push(
          createFinding(
            'PARTIES_LIST_INCONSISTENT',
            'low',
            `Document ${doc.name} names a ${role} ("${value}") absent from its parties list.`,
            { document: doc.name, role, name: value },
          ),
        );
      }
    }
  }
  return findings;
};

export const PARTIES_CHECKS: readonly CrossCheck[] = [
  {
    code: 'parties.no_self_deal',
    domain: 'parties',
    description: 'A document must not name one entity as buyer and supplier.',
    run: ruleNoSelfDeal,
  },
  {
    code: 'parties.buyer_consistency',
    domain: 'parties',
    description: 'The buyer name must be consistent across documents.',
    run: ruleBuyerConsistency,
  },
  {
    code: 'parties.no_duplicate_parties',
    domain: 'parties',
    description: 'A declared parties list must not contain duplicates.',
    run: ruleNoDuplicateParties,
  },
  {
    code: 'parties.named_parties_listed',
    domain: 'parties',
    description: 'A named supplier/buyer should appear in the parties list.',
    run: ruleNamedPartiesListed,
  },
];

registerChecks(PARTIES_CHECKS);
