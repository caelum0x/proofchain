/**
 * `lookup_sanctions` — screen a name and/or address against a sanctions/denied-
 * party list. Any hit is a hard compliance stop (the model should record a
 * critical finding and fail the verdict).
 *
 * The list is an in-memory, seedable denylist (a real deployment loads OFAC/EU
 * consolidated lists into it; tests seed their own entries). Matching is
 * deterministic: exact address match, or exact / substring name match after
 * normalization. No network, no clock.
 */
import { z } from 'zod';
import { HEX_ADDRESS, normalizeKey, normalizeParty } from './support.js';
import { registerTool } from './registry.js';

const NAME = 'lookup_sanctions';

export interface SanctionsEntry {
  readonly name: string;
  readonly program: string;
  readonly addresses?: readonly string[];
}

/** The denylist version reported with every screen (bump when the list changes). */
export const SANCTIONS_LIST_VERSION = 'demo-2026-01';

/** In-memory denylist keyed by an opaque entry id. */
const denylist = new Map<string, SanctionsEntry>();

/** Add/replace a denylist entry (used by real loaders and by tests). */
export const seedSanction = (id: string, entry: SanctionsEntry): void => {
  denylist.set(normalizeKey(id), entry);
};

/** Clear the denylist. TEST-ONLY. */
export const resetSanctions = (): void => {
  denylist.clear();
  seedDefaults();
};

function seedDefaults(): void {
  // A small illustrative seed set. Real lists are injected at deploy time.
  seedSanction('demo-blocked-trading', {
    name: 'Blocked Trading Co',
    program: 'DEMO-SDN',
    addresses: ['0x000000000000000000000000000000000000dead'],
  });
  seedSanction('demo-sanctioned-metals', {
    name: 'Sanctioned Metals LLC',
    program: 'DEMO-SDN',
  });
}

seedDefaults();

export const lookupSanctionsInput = z
  .object({
    name: z.string().min(1).max(200).optional(),
    address: z
      .string()
      .regex(HEX_ADDRESS, 'address must be a 0x 20-byte hex')
      .optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.address !== undefined, {
    message: 'Provide at least one of name or address.',
  });

export type LookupSanctionsInput = z.infer<typeof lookupSanctionsInput>;

interface Match {
  readonly entry: string;
  readonly program: string;
  readonly field: 'name' | 'address';
  readonly matchType: 'exact' | 'substring';
}

export const lookupSanctionsTool = registerTool<LookupSanctionsInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Screen a name and/or address against the sanctions/denied-party list. A ' +
      'hit is a hard compliance stop. Provide at least one of name/address.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Party name to screen.' },
        address: {
          type: 'string',
          description: '0x-prefixed 20-byte address to screen.',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: lookupSanctionsInput,
  handle: (input) => {
    const wantName =
      input.name !== undefined ? normalizeParty(input.name) : undefined;
    const wantAddr =
      input.address !== undefined ? normalizeKey(input.address) : undefined;
    const matches: Match[] = [];

    for (const entry of denylist.values()) {
      if (
        wantAddr !== undefined &&
        entry.addresses?.some((a) => normalizeKey(a) === wantAddr)
      ) {
        matches.push({
          entry: entry.name,
          program: entry.program,
          field: 'address',
          matchType: 'exact',
        });
        continue;
      }
      if (wantName !== undefined) {
        const entryName = normalizeParty(entry.name);
        if (entryName === wantName) {
          matches.push({
            entry: entry.name,
            program: entry.program,
            field: 'name',
            matchType: 'exact',
          });
        } else if (
          entryName.includes(wantName) ||
          wantName.includes(entryName)
        ) {
          matches.push({
            entry: entry.name,
            program: entry.program,
            field: 'name',
            matchType: 'substring',
          });
        }
      }
    }

    return {
      content: {
        query: { name: input.name ?? null, address: input.address ?? null },
        hit: matches.length > 0,
        matches,
        listVersion: SANCTIONS_LIST_VERSION,
      },
    };
  },
});
