/**
 * `get_kyc` — return the KYC/KYB status for a party (address or name).
 *
 * Sources, in order: a seeded KYC record (a real deployment feeds this from a
 * KYC provider / Supabase), else a DETERMINISTIC derivation from the party
 * string so the model always gets a concrete, reproducible answer offline.
 */
import { z } from 'zod';
import {
  createStore,
  deterministicBps,
  normalizeParty,
} from './support.js';
import { registerTool } from './registry.js';

const NAME = 'get_kyc';

export type KycLevel = 'none' | 'basic' | 'enhanced';
export type KycRisk = 'low' | 'medium' | 'high';

export interface KycRecord {
  readonly verified: boolean;
  readonly level: KycLevel;
  readonly riskRating: KycRisk;
  readonly expiresAt?: number;
}

/** Seedable KYC store keyed by normalized party. */
export const kycStore = createStore<KycRecord>();

export const getKycInput = z
  .object({
    party: z.string().min(1).max(200),
  })
  .strict();

export type GetKycInput = z.infer<typeof getKycInput>;

const deriveKyc = (key: string): KycRecord => {
  // Two independent hashes so verification and risk are not perfectly coupled.
  const trust = deterministicBps(`kyc:${key}`);
  const risk = deterministicBps(`kyc-risk:${key}`);
  const verified = trust >= 2_500;
  const level: KycLevel = !verified ? 'none' : trust >= 6_500 ? 'enhanced' : 'basic';
  const riskRating: KycRisk = risk >= 7_000 ? 'high' : risk >= 4_000 ? 'medium' : 'low';
  return { verified, level, riskRating };
};

export const getKycTool = registerTool<GetKycInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Return the KYC/KYB status for a party (address or name): whether it is ' +
      'verified, the verification level (none/basic/enhanced) and a risk rating.',
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
  inputSchema: getKycInput,
  handle: (input) => {
    const key = normalizeParty(input.party);
    const seeded = kycStore.get(key);
    const record = seeded ?? deriveKyc(key);
    return {
      content: {
        party: input.party,
        verified: record.verified,
        level: record.level,
        riskRating: record.riskRating,
        expiresAt: record.expiresAt ?? null,
        source: seeded !== undefined ? 'seeded' : 'derived',
      },
    };
  },
});
