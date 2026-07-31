/**
 * /checkpoints — provenance checkpoints (ProvenanceRegistry + CheckpointOracle).
 *
 * `/checkpoints/:batchId` returns the full ordered trail for a batch, read
 * canonically on-chain via `getCheckpoints`, falling back to indexed checkpoint
 * events when the contract is unavailable. `/checkpoints` is a recent-activity
 * feed across both `CheckpointAdded` (registry) and `CheckpointPushed` (oracle)
 * events from the `indexer_events` audit log.
 */
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import { hexBatchId, jsonSafe, parseOr400, readView, resolveContract } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import { z } from 'zod';

interface EventRow {
  event_name: string;
  args: Record<string, unknown>;
  block_number: string;
  tx_hash: string;
}

interface OnChainCheckpoint {
  batchId: string;
  location: string;
  timestamp: bigint;
  dataHash: string;
}

const TABLE = 'indexer_events';
const CONTRACT = 'ProvenanceRegistry';
const CHECKPOINT_EVENTS = new Set(['CheckpointAdded', 'CheckpointPushed']);
const PROVENANCE_FILTER = { group_name: 'provenance' } as const;

const BatchParams = z.object({ batchId: hexBatchId });

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const projectEvent = (row: EventRow): Record<string, unknown> => ({
  batchId: str(row.args.batchId),
  location: str(row.args.location),
  dataHash: str(row.args.dataHash),
  event: row.event_name,
  args: jsonSafe(row.args),
  blockNumber: row.block_number,
  txHash: row.tx_hash,
});

const readChainCheckpoints = async (
  ctx: AppContext,
  batchId: string,
): Promise<Record<string, unknown>[] | null> => {
  const contract = resolveContract(ctx, CONTRACT);
  if (contract === null) return null;
  const checkpoints = (await readView(ctx, contract, 'getCheckpoints', [batchId])) as
    | readonly OnChainCheckpoint[]
    | undefined;
  if (checkpoints === undefined) return null;
  return checkpoints.map((c) => ({
    batchId: c.batchId.toLowerCase(),
    location: c.location,
    timestamp: c.timestamp.toString(),
    dataHash: c.dataHash,
  }));
};

export default defineRoutes((app, ctx) => {
  app.get('/checkpoints', async (request) => {
    const pagination = parsePagination(request.query);
    // Both checkpoint event types live in the provenance group; refine the
    // fetched window in-memory since PostgREST `in` is outside the generic layer.
    const rows = await ctx.db.list<EventRow>(TABLE, {
      ...pagination,
      order: { column: 'block_number', ascending: false },
      filters: PROVENANCE_FILTER,
    });
    const matched = rows
      .filter((r) => CHECKPOINT_EVENTS.has(r.event_name))
      .map(projectEvent);
    return okPage(matched, pageMeta(matched.length, pagination));
  });

  app.get('/checkpoints/:batchId', async (request) => {
    const { batchId } = parseOr400(BatchParams, request.params);

    const onChain = await readChainCheckpoints(ctx, batchId);
    if (onChain !== null) {
      return okPage(onChain, pageMeta(onChain.length, { limit: onChain.length || 1, offset: 0 }));
    }

    // Fallback: reconstruct the trail from indexed checkpoint events.
    const rows = await ctx.db.list<EventRow>(TABLE, {
      limit: 100,
      order: { column: 'block_number', ascending: true },
      filters: PROVENANCE_FILTER,
    });
    const trail = rows
      .filter(
        (r) =>
          CHECKPOINT_EVENTS.has(r.event_name) &&
          str(r.args.batchId)?.toLowerCase() === batchId,
      )
      .map(projectEvent);
    return okPage(trail, pageMeta(trail.length, { limit: trail.length || 1, offset: 0 }));
  });
});
