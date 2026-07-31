/**
 * Marketplace service (M9: ListingRegistry, FinancingMarketplace, OrderBook).
 *
 * Aggregates the indexed `listings` projection (`active → cancelled | filled`)
 * with an on-chain `listingOf(id)` fallback. List / search by seller/kind/status;
 * detail is DB-first with an on-chain fallback.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'listings';
const CONTRACT = 'ListingRegistry';

export const LISTING_STATUSES = ['active', 'cancelled', 'filled'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** A listing row as stored in the indexed read model. */
export interface ListingRow {
  readonly id: string;
  readonly seller: string | null;
  readonly kind: string | null;
  readonly price: string | null;
  readonly status: string | null;
}

export type ListingDetail = ListingRow & { readonly source: 'db' | 'chain' };

/** Shape returned by the on-chain `listingOf(id)` view. */
interface OnChainListing {
  readonly seller: string;
  readonly kind: string;
  readonly price: bigint;
  readonly status: number;
  readonly exists: boolean;
}

export interface ListingListQuery {
  readonly pagination: Pagination;
  readonly seller?: string;
  readonly kind?: string;
  readonly status?: ListingStatus;
}

export interface MarketplaceService {
  list(query: ListingListQuery): Promise<ListResult<ListingRow>>;
  getById(id: string): Promise<ListingDetail | null>;
}

export const createMarketplaceService = defineService<MarketplaceService>(
  (ctx) => {
    const readChainListing = async (
      id: string,
    ): Promise<ListingRow | null> => {
      const contract = resolveContract(ctx, CONTRACT);
      if (contract === null) return null;
      const listing = (await readView(ctx, contract, 'listingOf', [id])) as
        | OnChainListing
        | undefined;
      if (listing === undefined || listing.exists !== true) return null;
      return jsonSafe({
        id,
        seller: listing.seller.toLowerCase(),
        kind: listing.kind,
        price: listing.price,
        status: LISTING_STATUSES[listing.status] ?? String(listing.status),
      }) as ListingRow;
    };

    return {
      async list({
        pagination,
        seller,
        kind,
        status,
      }): Promise<ListResult<ListingRow>> {
        const filters = compactFilters({ seller, kind, status });
        return pageRows<ListingRow>(ctx.db, {
          table: TABLE,
          pagination,
          ...(Object.keys(filters).length > 0 ? { filters } : {}),
          order: { column: 'created_at', ascending: false },
        });
      },

      async getById(id): Promise<ListingDetail | null> {
        const row = await ctx.db.getBy<ListingRow>(TABLE, 'id', id);
        if (row !== null) return { ...row, source: 'db' };

        const onChain = await readChainListing(id);
        if (onChain === null) return null;
        return { ...onChain, source: 'chain' };
      },
    };
  },
);
