/**
 * /attestations — AI verdicts recorded on-chain (AttestationRegistry).
 *
 * The on-chain registry is canonical for detail: `/attestations/:batchId` reads
 * `getAttestation` first and falls back to the indexed `verdicts` mirror when the
 * contract is unavailable or the batch is not yet on-chain. List/search read the
 * `verdicts` mirror (which carries the pass/fail + score projection).
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexBatchId,
  jsonSafe,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface VerdictRow {
  batch_id: string;
  score: number;
  passed: boolean;
  threshold: number;
  verdict_hash: string;
  verdict_uri: string | null;
  model: string;
}

interface OnChainAttestation {
  batchId: string;
  score: number;
  verdictHash: string;
  verdictURI: string;
  attestedAt: bigint;
  agent: string;
  exists: boolean;
}

const TABLE = 'verdicts';
const CONTRACT = 'AttestationRegistry';

const ListQuery = z.object({
  passed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
const SearchQuery = ListQuery.extend({
  minScore: z.coerce.number().int().min(0).max(10_000).optional(),
});
const BatchParams = z.object({ batchId: hexBatchId });

const readChainAttestation = async (
  ctx: AppContext,
  batchId: string,
): Promise<Record<string, unknown> | null> => {
  const contract = resolveContract(ctx, CONTRACT);
  if (contract === null) return null;
  const att = (await readView(ctx, contract, 'getAttestation', [batchId])) as
    | OnChainAttestation
    | undefined;
  if (att === undefined || att.exists !== true) return null;
  return jsonSafe({
    batchId: batchId.toLowerCase(),
    score: Number(att.score),
    verdictHash: att.verdictHash,
    verdictURI: att.verdictURI,
    attestedAt: att.attestedAt,
    agent: att.agent.toLowerCase(),
  }) as Record<string, unknown>;
};

export default defineRoutes((app, ctx) => {
  app.get('/attestations', async (request) => {
    const { passed } = parseOr400(ListQuery, request.query);
    const pagination = parsePagination(request.query);
    const filters = passed !== undefined ? { passed } : undefined;
    const [rows, total] = await Promise.all([
      ctx.db.list<VerdictRow>(TABLE, {
        ...pagination,
        order: { column: 'created_at', ascending: false },
        filters,
      }),
      ctx.db.count(TABLE, filters),
    ]);
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/attestations/search', async (request) => {
    const { passed, minScore } = parseOr400(SearchQuery, request.query);
    const pagination = parsePagination(request.query);
    const filters = passed !== undefined ? { passed } : undefined;
    const rows = await ctx.db.list<VerdictRow>(TABLE, {
      ...pagination,
      order: { column: 'score', ascending: false },
      filters,
    });
    const matched =
      minScore === undefined ? rows : rows.filter((r) => r.score >= minScore);
    return okPage(matched, pageMeta(matched.length, pagination));
  });

  app.get('/attestations/:batchId', async (request) => {
    const { batchId } = parseOr400(BatchParams, request.params);

    const onChain = await readChainAttestation(ctx, batchId);
    if (onChain !== null) return ok({ ...onChain, source: 'chain' as const });

    const row = await ctx.db.getBy<VerdictRow>(TABLE, 'batch_id', batchId);
    if (row === null) {
      throw notFound(`Attestation for batch ${batchId} not found`);
    }
    return ok({ ...row, source: 'db' as const });
  });
});
