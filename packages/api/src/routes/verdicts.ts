/**
 * /verdicts — the AI verification verdict cache (`verdicts` table).
 *
 * Unlike `/attestations` (on-chain canonical), this serves the full off-chain
 * verdict payload the agent produced — structured `findings`, `document_hashes`
 * and `model` — from Supabase only. Detail 404s when a batch has no cached
 * verdict.
 */
import { z } from 'zod';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import { hexBatchId, parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface VerdictRow {
  batch_id: string;
  score: number;
  passed: boolean;
  threshold: number;
  findings: unknown;
  document_hashes: unknown;
  verdict_hash: string;
  verdict_uri: string | null;
  model: string;
}

const TABLE = 'verdicts';

const ListQuery = z.object({
  passed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
const SearchQuery = ListQuery.extend({
  minScore: z.coerce.number().int().min(0).max(10_000).optional(),
  model: z.string().trim().min(1).optional(),
});
const BatchParams = z.object({ batchId: hexBatchId });

export default defineRoutes((app, ctx) => {
  app.get('/verdicts', async (request) => {
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

  app.get('/verdicts/search', async (request) => {
    const { passed, minScore, model } = parseOr400(SearchQuery, request.query);
    const pagination = parsePagination(request.query);
    const filters: Record<string, string | boolean> = {};
    if (passed !== undefined) filters.passed = passed;
    if (model !== undefined) filters.model = model;
    const rows = await ctx.db.list<VerdictRow>(TABLE, {
      ...pagination,
      order: { column: 'score', ascending: false },
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });
    const matched =
      minScore === undefined ? rows : rows.filter((r) => r.score >= minScore);
    return okPage(matched, pageMeta(matched.length, pagination));
  });

  app.get('/verdicts/:batchId', async (request) => {
    const { batchId } = parseOr400(BatchParams, request.params);
    const row = await ctx.db.getBy<VerdictRow>(TABLE, 'batch_id', batchId);
    if (row === null) {
      throw notFound(`Verdict for batch ${batchId} not found`);
    }
    return ok(row);
  });
});
