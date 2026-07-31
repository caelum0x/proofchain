/**
 * `get_checkpoints` — return the on-chain checkpoint trail for the batch, with
 * optional filtering (by location / since a timestamp) and a limit. Also reports
 * whether the trail is chronological, which is a provenance-integrity signal the
 * model would otherwise have to compute by hand.
 *
 * Real logic: reads straight from the provenance already loaded into context; no
 * external calls, fully deterministic.
 */
import { z } from 'zod';
import { registerTool } from './registry.js';
import type { Checkpoint } from '../domain/types.js';

const NAME = 'get_checkpoints';

export const getCheckpointsInput = z
  .object({
    location: z.string().min(1).max(200).optional(),
    sinceTimestamp: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().max(1_000).optional(),
  })
  .strict();

export type GetCheckpointsInput = z.infer<typeof getCheckpointsInput>;

/** True when timestamps are non-decreasing across the list. */
const isChronological = (cps: readonly Checkpoint[]): boolean => {
  for (let i = 1; i < cps.length; i += 1) {
    const prev = cps[i - 1];
    const cur = cps[i];
    if (prev !== undefined && cur !== undefined && cur.timestamp < prev.timestamp) {
      return false;
    }
  }
  return true;
};

export const getCheckpointsTool = registerTool<GetCheckpointsInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Return the on-chain checkpoint trail for this batch (location, ' +
      'timestamp, dataHash), optionally filtered by `location` substring or ' +
      '`sinceTimestamp` and capped by `limit`. Reports whether the full trail ' +
      'is chronological.',
    input_schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Case-insensitive substring to filter checkpoint locations.',
        },
        sinceTimestamp: {
          type: 'integer',
          description: 'Only return checkpoints at/after this unix-seconds time.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of checkpoints to return.',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: getCheckpointsInput,
  handle: (input, ctx) => {
    const all = ctx.provenance.checkpoints;
    const needle = input.location?.trim().toLowerCase();

    let filtered = all.filter((cp) => {
      if (needle !== undefined && !cp.location.toLowerCase().includes(needle)) {
        return false;
      }
      if (input.sinceTimestamp !== undefined && cp.timestamp < input.sinceTimestamp) {
        return false;
      }
      return true;
    });

    const matched = filtered.length;
    if (input.limit !== undefined) {
      filtered = filtered.slice(0, input.limit);
    }

    return {
      content: {
        batchId: ctx.provenance.batchId,
        total: all.length,
        matched,
        returned: filtered.length,
        chronological: isChronological(all),
        checkpoints: filtered,
      },
    };
  },
});
