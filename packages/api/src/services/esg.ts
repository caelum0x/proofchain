/**
 * ESG service (M8: ESGRegistry, SustainabilityOracle).
 *
 * Aggregates the indexed `esg` projection (per-subject score + attestation URI)
 * with an on-chain `scoreOf(subject)` fallback. A subject is a batchId or an org
 * address stored as text. `getBySubject` returns the LATEST record for a subject
 * (the column is indexed but not unique).
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';

const TABLE = 'esg';
const CONTRACT = 'ESGRegistry';

/** An ESG record as stored in the indexed read model. */
export interface EsgRow {
  readonly subject: string;
  readonly score: number | null;
  readonly rating: string | null;
  readonly uri: string | null;
}

export type EsgDetail = EsgRow & { readonly source: 'db' | 'chain' };

/** Shape returned by the on-chain `scoreOf(subject)` view. */
interface OnChainScore {
  readonly score: number | bigint;
  readonly rating: string;
  readonly uri: string;
  readonly updatedAt: bigint;
  readonly exists: boolean;
}

export interface EsgListQuery {
  readonly pagination: Pagination;
  readonly subject?: string;
  readonly minScore?: number;
}

export interface EsgService {
  /** Page indexed ESG records, optionally filtered by subject / minimum score. */
  list(query: EsgListQuery): Promise<ListResult<EsgRow>>;
  /** Latest record for a subject (DB-first, on-chain fallback), or null. */
  getBySubject(subject: string): Promise<EsgDetail | null>;
}

export const createEsgService = defineService<EsgService>((ctx) => {
  const readChainScore = async (subject: string): Promise<EsgRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const score = (await readView(ctx, contract, 'scoreOf', [subject])) as
      | OnChainScore
      | undefined;
    if (score === undefined || score.exists !== true) return null;
    return jsonSafe({
      subject,
      score: Number(score.score),
      rating: score.rating,
      uri: score.uri,
    }) as EsgRow;
  };

  return {
    async list({
      pagination,
      subject,
      minScore,
    }): Promise<ListResult<EsgRow>> {
      const result = await pageRows<EsgRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(subject !== undefined ? { filters: { subject } } : {}),
        order: { column: 'created_at', ascending: false },
      });
      if (minScore === undefined) return result;
      const rows = result.rows.filter((r) => (r.score ?? 0) >= minScore);
      return { rows, total: rows.length };
    },

    async getBySubject(subject): Promise<EsgDetail | null> {
      const rows = await ctx.db.list<EsgRow>(TABLE, {
        filters: { subject },
        order: { column: 'created_at', ascending: false },
        limit: 1,
      });
      const row = rows[0];
      if (row !== undefined) return { ...row, source: 'db' };

      const onChain = await readChainScore(subject);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },
  };
});
