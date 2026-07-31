/**
 * /batches — provenance batches (ProvenanceRegistry).
 *
 * Batches have no dedicated read-model table: the append-only `indexer_events`
 * audit log is the source for list/search (BatchRegistered events), while detail
 * is read canonically on-chain via `getBatch` + `checkpointCount`, falling back
 * to the indexed registration event when the contract is unavailable.
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexAddress,
  hexBatchId,
  jsonSafe,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface EventRow {
  event_name: string;
  args: Record<string, unknown>;
  block_number: string;
  tx_hash: string;
}

interface OnChainBatch {
  batchId: string;
  supplier: string;
  originHash: string;
  metadataURI: string;
  createdAt: bigint;
  exists: boolean;
}

const TABLE = 'indexer_events';
const CONTRACT = 'ProvenanceRegistry';
const EVENT = 'BatchRegistered';
const BASE_FILTER = { event_name: EVENT } as const;

const SearchQuery = z.object({ supplier: hexAddress.optional() });
const BatchParams = z.object({ batchId: hexBatchId });

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const projectEvent = (row: EventRow): Record<string, unknown> => ({
  batchId: str(row.args.batchId),
  supplier: str(row.args.supplier)?.toLowerCase() ?? null,
  originHash: str(row.args.originHash),
  metadataURI: str(row.args.metadataURI),
  blockNumber: row.block_number,
  txHash: row.tx_hash,
});

const readChainBatch = async (
  ctx: AppContext,
  batchId: string,
): Promise<Record<string, unknown> | null> => {
  const contract = resolveContract(ctx, CONTRACT);
  if (contract === null) return null;
  const batch = (await readView(ctx, contract, 'getBatch', [batchId])) as
    | OnChainBatch
    | undefined;
  if (batch === undefined || batch.exists !== true) return null;
  const count = (await readView(ctx, contract, 'checkpointCount', [batchId])) as bigint;
  return jsonSafe({
    batchId: batchId.toLowerCase(),
    supplier: batch.supplier.toLowerCase(),
    originHash: batch.originHash,
    metadataURI: batch.metadataURI,
    createdAt: batch.createdAt,
    checkpointCount: count,
  }) as Record<string, unknown>;
};

export default defineRoutes((app, ctx) => {
  app.get('/batches', async (request) => {
    const pagination = parsePagination(request.query);
    const [rows, total] = await Promise.all([
      ctx.db.list<EventRow>(TABLE, {
        ...pagination,
        order: { column: 'block_number', ascending: false },
        filters: BASE_FILTER,
      }),
      ctx.db.count(TABLE, BASE_FILTER),
    ]);
    return okPage(rows.map(projectEvent), pageMeta(total, pagination));
  });

  app.get('/batches/search', async (request) => {
    const { supplier } = parseOr400(SearchQuery, request.query);
    const pagination = parsePagination(request.query);
    // `supplier` lives in the jsonb `args` (not a column), so filter the
    // fetched window in-memory. `event_name` remains an indexed column filter.
    const rows = await ctx.db.list<EventRow>(TABLE, {
      ...pagination,
      order: { column: 'block_number', ascending: false },
      filters: BASE_FILTER,
    });
    const projected = rows.map(projectEvent);
    const matched =
      supplier === undefined
        ? projected
        : projected.filter((r) => r.supplier === supplier);
    return okPage(matched, pageMeta(matched.length, pagination));
  });

  app.get('/batches/:batchId', async (request) => {
    const { batchId } = parseOr400(BatchParams, request.params);

    const onChain = await readChainBatch(ctx, batchId);
    if (onChain !== null) return ok({ ...onChain, source: 'chain' as const });

    // Fallback: locate the registration event in the indexed window.
    const rows = await ctx.db.list<EventRow>(TABLE, {
      limit: 100,
      order: { column: 'block_number', ascending: false },
      filters: BASE_FILTER,
    });
    const match = rows.find((r) => str(r.args.batchId)?.toLowerCase() === batchId);
    if (match === undefined) {
      throw notFound(`Batch ${batchId} not found`);
    }
    return ok({ ...projectEvent(match), source: 'db' as const });
  });
});
