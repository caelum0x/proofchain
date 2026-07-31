/**
 * Sanctions cross-check pack.
 *
 * Screens every party named in the document set — and the on-chain supplier
 * address — against a denylist of sanctioned entities and blocked wallet
 * addresses. A single match is a hard compliance stop (critical), because a
 * financial or provenance action against a sanctioned counterparty is illegal.
 *
 * The denylist is an in-memory, offline fixture (no network calls). A real
 * deployment swaps in an OFAC/EU-consolidated feed behind the same interface;
 * the matching logic is identical.
 */
import { z } from 'zod';
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { normName, partyNames } from './util.js';
import type { CrossCheckInput } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** Denylist schema — validated at module load so a malformed fixture fails loud. */
const denylistSchema = z.object({
  names: z.array(z.string().min(1)),
  addresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40}$/)),
});

/**
 * Fictional-but-realistic sanctioned entities. NONE of these collide with the
 * benign fixture names used across the test-suite (Acme, Globex, …).
 */
const DENYLIST = denylistSchema.parse({
  names: [
    'blocked trading co',
    'sanctioned entity ltd',
    'redlist logistics',
    'pariah shipping llc',
    'embargo holdings',
  ],
  addresses: ['0x000000000000000000000000000000000000dead'],
});

const SANCTIONED_NAMES = new Set(DENYLIST.names.map(normName));
const SANCTIONED_ADDRESSES = new Set(
  DENYLIST.addresses.map((a) => a.toLowerCase()),
);

/** Any named party matching the denylist blocks the shipment. */
const rulePartyScreening = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    for (const name of partyNames(doc)) {
      if (SANCTIONED_NAMES.has(name)) {
        findings.push(
          createFinding(
            'SANCTIONED_PARTY',
            'critical',
            `Document ${doc.name} names a sanctioned party ("${name}").`,
            { document: doc.name, party: name },
          ),
        );
      }
    }
  }
  return findings;
};

/** The on-chain supplier address must not be on the blocked-address list. */
const ruleAddressScreening = (input: CrossCheckInput): Finding[] => {
  const supplier = input.provenance.supplier.toLowerCase();
  if (SANCTIONED_ADDRESSES.has(supplier)) {
    return [
      createFinding(
        'SANCTIONED_ADDRESS',
        'critical',
        'The on-chain supplier address is on the blocked-address list.',
        { supplier: input.provenance.supplier },
      ),
    ];
  }
  return [];
};

export const SANCTIONS_CHECKS: readonly CrossCheck[] = [
  {
    code: 'sanctions.party_screening',
    domain: 'sanctions',
    description: 'No named party may appear on the sanctions denylist.',
    run: rulePartyScreening,
  },
  {
    code: 'sanctions.address_screening',
    domain: 'sanctions',
    description: 'The on-chain supplier address must not be blocked.',
    run: ruleAddressScreening,
  },
];

registerChecks(SANCTIONS_CHECKS);
