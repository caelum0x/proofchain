/**
 * `get_attestation` — report the attestation status for a batch. Two sources are
 * reconciled:
 *   1. a prior ON-CHAIN attestation, if one has been indexed into the seedable
 *      attestation store (a real deployment seeds this from the chain indexer /
 *      Supabase; tests seed it directly), and
 *   2. the IN-LOOP attestation the model is currently building — i.e. whether it
 *      has already called `finalize_verdict` this session and with what score.
 *
 * This lets the model detect a re-verification (a batch already attested) and
 * see its own pending verdict, without any network call.
 */
import { z } from 'zod';
import { HEX32, createStore } from './support.js';
import { registerTool } from './registry.js';

const NAME = 'get_attestation';

/** A prior on-chain attestation record (subset of the chain tuple). */
export interface StoredAttestation {
  readonly score: number;
  readonly verdictHash: string;
  readonly verdictURI: string;
  readonly attestedAt: number;
  readonly agent: string;
}

/** Seedable store of prior attestations, keyed by batchId. */
export const attestationStore = createStore<StoredAttestation>();

export const getAttestationInput = z
  .object({
    batchId: z
      .string()
      .regex(HEX32, 'batchId must be a 0x 32-byte hex string')
      .optional(),
  })
  .strict();

export type GetAttestationInput = z.infer<typeof getAttestationInput>;

export const getAttestationTool = registerTool<GetAttestationInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Report the attestation status for a batch: any prior on-chain ' +
      'attestation (score, verdict hash/URI, agent) AND the in-progress verdict ' +
      'from this session. Use it to detect a re-verification of an already ' +
      'attested batch. Defaults to the batch under verification.',
    input_schema: {
      type: 'object',
      properties: {
        batchId: {
          type: 'string',
          description: '0x-prefixed 32-byte batch id (defaults to this batch).',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: getAttestationInput,
  handle: (input, ctx, state) => {
    const batchId = input.batchId ?? ctx.provenance.batchId;
    const prior = attestationStore.get(batchId);
    const isThisBatch = batchId.toLowerCase() === ctx.provenance.batchId.toLowerCase();

    const pending = isThisBatch
      ? {
          finalized: state.finalized,
          proposedScore: state.finalized ? state.modelScore : null,
          summary: state.finalized ? state.summary : null,
        }
      : { finalized: false, proposedScore: null, summary: null };

    const status = prior !== undefined ? 'attested' : pending.finalized ? 'pending' : 'none';

    return {
      content: {
        batchId,
        status,
        priorAttestation: prior ?? null,
        pending,
      },
    };
  },
});
