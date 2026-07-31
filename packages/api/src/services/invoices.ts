/**
 * Invoices service (M5: InvoiceNFT + ReceivableRegistry).
 *
 * Each funded+attested deal mints a receivable NFT (`tokenId = uint256(batchId)`)
 * with terms (face value, obligor, holder, due, status). Aggregates the indexed
 * `receivables` projection with an on-chain `receivableOf(batchId)` fallback.
 * Detail is keyed by `batch_id`.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'receivables';
const CONTRACT = 'ReceivableRegistry';

export const RECEIVABLE_STATUSES = [
  'registered',
  'listed',
  'funded',
  'claimed',
  'settled',
] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

/** A receivable row as stored in the indexed read model. */
export interface ReceivableRow {
  readonly batch_id: string;
  readonly token_id: string | null;
  readonly holder: string | null;
  readonly obligor: string | null;
  readonly face_value: string | null;
  readonly due_date: string | null;
  readonly status: string | null;
}

export type ReceivableDetail = ReceivableRow & {
  readonly source: 'db' | 'chain';
};

/** Shape returned by the on-chain `receivableOf(batchId)` view. */
interface OnChainReceivable {
  readonly holder: string;
  readonly obligor: string;
  readonly faceValue: bigint;
  readonly dueDate: bigint;
  readonly status: number;
  readonly exists: boolean;
}

export interface ReceivableListQuery {
  readonly pagination: Pagination;
  readonly holder?: string;
  readonly obligor?: string;
  readonly status?: ReceivableStatus;
}

export interface InvoicesService {
  list(query: ReceivableListQuery): Promise<ListResult<ReceivableRow>>;
  getByBatchId(batchId: string): Promise<ReceivableDetail | null>;
}

export const createInvoicesService = defineService<InvoicesService>((ctx) => {
  const readChainReceivable = async (
    batchId: string,
  ): Promise<ReceivableRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const rec = (await readView(ctx, contract, 'receivableOf', [batchId])) as
      | OnChainReceivable
      | undefined;
    if (rec === undefined || rec.exists !== true) return null;
    return jsonSafe({
      batch_id: batchId.toLowerCase(),
      token_id: BigInt(batchId),
      holder: rec.holder.toLowerCase(),
      obligor: rec.obligor.toLowerCase(),
      face_value: rec.faceValue,
      due_date: rec.dueDate,
      status: RECEIVABLE_STATUSES[rec.status] ?? String(rec.status),
    }) as ReceivableRow;
  };

  return {
    async list({
      pagination,
      holder,
      obligor,
      status,
    }): Promise<ListResult<ReceivableRow>> {
      const filters = compactFilters({ holder, obligor, status });
      return pageRows<ReceivableRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getByBatchId(batchId): Promise<ReceivableDetail | null> {
      const row = await ctx.db.getBy<ReceivableRow>(TABLE, 'batch_id', batchId);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainReceivable(batchId);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },
  };
});
