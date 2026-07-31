/**
 * `lookup_reputation` — return a counterparty reputation score (0..10000, higher
 * = better standing) for a party (address or name).
 *
 * Sources, in order:
 *   1. a seeded reputation record (real deployment feeds this from Supabase /
 *      an external reputation oracle), else
 *   2. a DETERMINISTIC derivation from the party string, nudged UP when the party
 *      is the batch's on-chain supplier and the batch carries a real checkpoint
 *      trail (an established, actively-tracked counterparty).
 */
import { z } from 'zod';
import {
  clampBps,
  createStore,
  deterministicBps,
  gradeOf,
  normalizeParty,
} from './support.js';
import { registerTool } from './registry.js';

const NAME = 'lookup_reputation';

export interface ReputationRecord {
  readonly score: number;
  readonly dealsCompleted?: number;
  readonly disputes?: number;
}

/** Seedable reputation store keyed by normalized party (address or name). */
export const reputationStore = createStore<ReputationRecord>();

export const lookupReputationInput = z
  .object({
    party: z.string().min(1).max(200),
  })
  .strict();

export type LookupReputationInput = z.infer<typeof lookupReputationInput>;

export const lookupReputationTool = registerTool<LookupReputationInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Look up a counterparty reputation score (0..10000, higher = better) and ' +
      'grade for a party (on-chain address or company name).',
    input_schema: {
      type: 'object',
      properties: {
        party: {
          type: 'string',
          description: 'Counterparty address or name to look up.',
        },
      },
      required: ['party'],
      additionalProperties: false,
    },
  },
  inputSchema: lookupReputationInput,
  handle: (input, ctx) => {
    const key = normalizeParty(input.party);
    const seeded = reputationStore.get(key);
    if (seeded !== undefined) {
      const score = clampBps(seeded.score);
      return {
        content: {
          party: input.party,
          score,
          grade: gradeOf(score),
          source: 'seeded',
          dealsCompleted: seeded.dealsCompleted ?? null,
          disputes: seeded.disputes ?? null,
        },
      };
    }

    const factors: string[] = [];
    let score = deterministicBps(`rep:${key}`);

    const supplier = normalizeParty(ctx.provenance.supplier);
    const supplierNames = new Set(
      ctx.documents
        .map((d) => d.fields.supplierName)
        .filter((n): n is string => n !== undefined && n.length > 0)
        .map(normalizeParty),
    );
    const isKnownCounterparty = key === supplier || supplierNames.has(key);

    if (isKnownCounterparty && ctx.provenance.exists) {
      const boost = 1_000 + Math.min(ctx.provenance.checkpoints.length, 10) * 200;
      score = clampBps(score + boost);
      factors.push(`known_counterparty(+${boost})`);
    }

    return {
      content: {
        party: input.party,
        score,
        grade: gradeOf(score),
        source: 'derived',
        factors,
      },
    };
  },
});
