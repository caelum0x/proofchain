/**
 * Carbon service (M8: CarbonCreditToken, OffsetMarketplace, SustainabilityOracle).
 *
 * Aggregates the indexed `carbon` projection (per project/batch CO2e emitted vs
 * retired) and can summarize the net outstanding footprint for a project. Detail
 * is DB-only (the projection row id has no direct single on-chain view); the
 * chain-backed per-subject score lives in the ESG service.
 */
import type { Pagination } from '../lib/pagination.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'carbon';

/** A carbon record as stored in the indexed read model. */
export interface CarbonRow {
  readonly id: string;
  readonly project_id: string | null;
  readonly batch_id: string | null;
  readonly emitted: string | null;
  readonly retired: string | null;
}

/** Net footprint summary for a project. */
export interface CarbonSummary {
  readonly projectId: string;
  readonly emitted: string;
  readonly retired: string;
  readonly outstanding: string;
  readonly records: number;
}

export interface CarbonListQuery {
  readonly pagination: Pagination;
  readonly projectId?: string;
  readonly batchId?: string;
}

export interface CarbonService {
  list(query: CarbonListQuery): Promise<ListResult<CarbonRow>>;
  getById(id: string): Promise<CarbonRow | null>;
  /** Sum emitted vs retired CO2e across a project's indexed records. */
  summarize(projectId: string): Promise<CarbonSummary>;
}

const toBig = (value: string | null): bigint => {
  if (value === null || !/^\d+$/.test(value)) return 0n;
  return BigInt(value);
};

export const createCarbonService = defineService<CarbonService>((ctx) => ({
  async list({
    pagination,
    projectId,
    batchId,
  }): Promise<ListResult<CarbonRow>> {
    const filters = compactFilters({
      project_id: projectId,
      batch_id: batchId,
    });
    return pageRows<CarbonRow>(ctx.db, {
      table: TABLE,
      pagination,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
      order: { column: 'created_at', ascending: false },
    });
  },

  async getById(id): Promise<CarbonRow | null> {
    return ctx.db.getBy<CarbonRow>(TABLE, 'id', id);
  },

  async summarize(projectId): Promise<CarbonSummary> {
    const rows = await ctx.db.list<CarbonRow>(TABLE, {
      filters: { project_id: projectId },
      order: { column: 'created_at', ascending: false },
    });
    let emitted = 0n;
    let retired = 0n;
    for (const row of rows) {
      emitted += toBig(row.emitted);
      retired += toBig(row.retired);
    }
    return {
      projectId,
      emitted: emitted.toString(),
      retired: retired.toString(),
      outstanding: (emitted - retired).toString(),
      records: rows.length,
    };
  },
}));
