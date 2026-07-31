/**
 * `get_policy` — return the verification policy the model should verify against:
 * the pass threshold, per-severity penalties, document requirements, and the
 * critical-auto-fail rule. Exposing the policy explicitly lets the model align
 * its finalize_verdict score with the deterministic gate it will be reconciled
 * against.
 *
 * The default policy is derived from the engine constants; named policies can be
 * seeded (a real deployment loads per-corridor / per-product policies from
 * Supabase).
 */
import { z } from 'zod';
import {
  DEFAULT_MAX_DOCUMENTS,
  DEFAULT_PASS_THRESHOLD_BPS,
  MAX_SCORE_BPS,
  SEVERITY_PENALTY_BPS,
} from '../config/constants.js';
import { createStore } from './support.js';
import { registerTool } from './registry.js';

const NAME = 'get_policy';

export interface Policy {
  readonly policyId: string;
  readonly passThresholdBps: number;
  readonly severityPenaltyBps: Record<string, number>;
  readonly maxDocuments: number;
  readonly requiredDocTypes: readonly string[];
  readonly criticalAutoFail: boolean;
}

export const DEFAULT_POLICY: Policy = {
  policyId: 'default',
  passThresholdBps: DEFAULT_PASS_THRESHOLD_BPS,
  severityPenaltyBps: { ...SEVERITY_PENALTY_BPS },
  maxDocuments: DEFAULT_MAX_DOCUMENTS,
  requiredDocTypes: ['invoice'],
  criticalAutoFail: SEVERITY_PENALTY_BPS.critical >= MAX_SCORE_BPS,
};

/** Seedable store of named policies (the default is served when unseeded). */
export const policyStore = createStore<Policy>();

export const getPolicyInput = z
  .object({
    policyId: z.string().min(1).max(64).optional(),
  })
  .strict();

export type GetPolicyInput = z.infer<typeof getPolicyInput>;

export const getPolicyTool = registerTool<GetPolicyInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Return the verification policy: pass threshold (bps), per-severity ' +
      'penalties, required document types, max documents, and whether a critical ' +
      'finding auto-fails. Pass `policyId` for a named policy, else the default.',
    input_schema: {
      type: 'object',
      properties: {
        policyId: {
          type: 'string',
          description: 'A named policy id (defaults to "default").',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: getPolicyInput,
  handle: (input) => {
    if (input.policyId === undefined || input.policyId === DEFAULT_POLICY.policyId) {
      return { content: { ...DEFAULT_POLICY, source: 'default' } };
    }
    const seeded = policyStore.get(input.policyId);
    if (seeded === undefined) {
      return {
        content: {
          error: `Unknown policy "${input.policyId}"`,
          fallback: { ...DEFAULT_POLICY, source: 'default' },
        },
        isError: true,
      };
    }
    return { content: { ...seeded, source: 'seeded' } };
  },
});
