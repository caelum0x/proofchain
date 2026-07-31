/**
 * Financing service (M5: InvoiceFinancing).
 *
 * A supplier lists an attested receivable at a discount; a lender funds it and
 * becomes the escrow payee; on release the lender is repaid and the remainder
 * goes to the supplier. Aggregates the indexed `financing_listings` projection
 * (`listed → funded → claimed | cancelled`) with an on-chain `listingOf(batchId)`
 * fallback. Detail is keyed by `batch_id`.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'financing_listings';
const CONTRACT = 'InvoiceFinancing';

export const FINANCING_STATUSES = [
  'listed',
  'funded',
  'claimed',
  'cancelled',
] as const;
export type FinancingStatus = (typeof FINANCING_STATUSES)[number];

/** A financing listing row as stored in the indexed read model. */
export interface FinancingRow {
  readonly batch_id: string;
  readonly supplier: string | null;
  readonly lender: string | null;
  readonly face_value: string | null;
  readonly discount_bps: number | null;
  readonly status: string | null;
}

export type FinancingDetail = FinancingRow & {
  readonly source: 'db' | 'chain';
};

/** Shape returned by the on-chain `listingOf(batchId)` view. */
interface OnChainListing {
  readonly supplier: string;
  readonly lender: string;
  readonly faceValue: bigint;
  readonly discountBps: number | bigint;
  readonly status: number;
  readonly exists: boolean;
}

export interface FinancingListQuery {
  readonly pagination: Pagination;
  readonly supplier?: string;
  readonly lender?: string;
  readonly status?: FinancingStatus;
}

export interface FinancingService {
  list(query: FinancingListQuery): Promise<ListResult<FinancingRow>>;
  getByBatchId(batchId: string): Promise<FinancingDetail | null>;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const createFinancingService = defineService<FinancingService>((ctx) => {
  const readChainListing = async (
    batchId: string,
  ): Promise<FinancingRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const listing = (await readView(ctx, contract, 'listingOf', [batchId])) as
      | OnChainListing
      | undefined;
    if (listing === undefined || listing.exists !== true) return null;
    const lender = listing.lender.toLowerCase();
    return jsonSafe({
      batch_id: batchId.toLowerCase(),
      supplier: listing.supplier.toLowerCase(),
      lender: lender === ZERO_ADDRESS ? null : lender,
      face_value: listing.faceValue,
      discount_bps: Number(listing.discountBps),
      status: FINANCING_STATUSES[listing.status] ?? String(listing.status),
    }) as FinancingRow;
  };

  return {
    async list({
      pagination,
      supplier,
      lender,
      status,
    }): Promise<ListResult<FinancingRow>> {
      const filters = compactFilters({ supplier, lender, status });
      return pageRows<FinancingRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getByBatchId(batchId): Promise<FinancingDetail | null> {
      const row = await ctx.db.getBy<FinancingRow>(TABLE, 'batch_id', batchId);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainListing(batchId);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },
  };
});
