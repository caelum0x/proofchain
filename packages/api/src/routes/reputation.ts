/**
 * /reputation — on-chain supplier reputation (M4 ReputationEngine + ScoreOracle).
 *
 * The list route doubles as a leaderboard (ordered by average attestation score).
 * Detail is DB-first with an on-chain `reputationOf` fallback; when available the
 * composite risk `grade` is read from the ScoreOracle. A supplier with no history
 * is a valid answer (all zeros) rather than a 404.
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexAddress,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface ReputationRow {
  supplier: string;
  avg_score_bps: number;
  total_deals: number;
  pass_rate_bps: number;
  disputes: number;
  grade: number | null;
}

const TABLE = 'reputation';
const ENGINE = 'ReputationEngine';
const ORACLE = 'ScoreOracle';

const SORTABLE = ['avg_score_bps', 'pass_rate_bps', 'total_deals'] as const;
const ListQuery = z.object({
  sort: z.enum(SORTABLE).default('avg_score_bps'),
});
const AddressParams = z.object({ address: hexAddress });

const readGrade = async (
  ctx: AppContext,
  supplier: string,
): Promise<number | null> => {
  const oracle = resolveContract(ctx, ORACLE);
  if (oracle === null) return null;
  const grade = (await readView(ctx, oracle, 'gradeOf', [supplier])) as
    | number
    | bigint
    | undefined;
  return grade === undefined ? null : Number(grade);
};

const readChainReputation = async (
  ctx: AppContext,
  supplier: string,
): Promise<ReputationRow | null> => {
  const engine = resolveContract(ctx, ENGINE);
  if (engine === null) return null;
  const result = (await readView(ctx, engine, 'reputationOf', [supplier])) as
    | readonly [number | bigint, bigint, number | bigint, bigint]
    | undefined;
  if (result === undefined) return null;
  const [avgScoreBps, totalDeals, passRateBps, disputes] = result;
  const grade = await readGrade(ctx, supplier);
  return {
    supplier: supplier.toLowerCase(),
    avg_score_bps: Number(avgScoreBps),
    total_deals: Number(totalDeals),
    pass_rate_bps: Number(passRateBps),
    disputes: Number(disputes),
    grade,
  };
};

export default defineRoutes((app, ctx) => {
  app.get('/reputation', async (request) => {
    const { sort } = parseOr400(ListQuery, request.query);
    const pagination = parsePagination(request.query);
    const [rows, total] = await Promise.all([
      ctx.db.list<ReputationRow>(TABLE, {
        ...pagination,
        order: { column: sort, ascending: false },
      }),
      ctx.db.count(TABLE),
    ]);
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/reputation/:address', async (request) => {
    const { address } = parseOr400(AddressParams, request.params);
    const row = await ctx.db.getBy<ReputationRow>(TABLE, 'supplier', address);
    if (row !== null) return ok({ ...row, source: 'db' as const });

    const onChain = await readChainReputation(ctx, address);
    if (onChain === null) {
      return ok({
        supplier: address,
        avg_score_bps: 0,
        total_deals: 0,
        pass_rate_bps: 0,
        disputes: 0,
        grade: null,
        source: 'unknown' as const,
      });
    }
    return ok({ ...onChain, source: 'chain' as const });
  });
});
