/**
 * Auctions service (M9: AuctionHouse).
 *
 * Aggregates the indexed `auctions` projection (`active → settled | cancelled`,
 * tracking the highest bid/bidder and end time) with an on-chain `auctionOf(id)`
 * fallback, and exposes the raw bid events from the append-only audit log.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'auctions';
const EVENTS_TABLE = 'indexer_events';
const CONTRACT = 'AuctionHouse';
const GROUP = 'marketplace';

export const AUCTION_STATUSES = ['active', 'settled', 'cancelled'] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

/** An auction row as stored in the indexed read model. */
export interface AuctionRow {
  readonly id: string;
  readonly seller: string | null;
  readonly highest_bid: string | null;
  readonly highest_bidder: string | null;
  readonly end_time: string | null;
  readonly status: string | null;
}

export type AuctionDetail = AuctionRow & { readonly source: 'db' | 'chain' };

/** A projected bid event row from the audit log. */
export type BidEventRow = Record<string, unknown>;

/** Shape returned by the on-chain `auctionOf(id)` view. */
interface OnChainAuction {
  readonly seller: string;
  readonly highestBid: bigint;
  readonly highestBidder: string;
  readonly endTime: bigint;
  readonly status: number;
  readonly exists: boolean;
}

export interface AuctionListQuery {
  readonly pagination: Pagination;
  readonly seller?: string;
  readonly status?: AuctionStatus;
}

export interface AuctionsService {
  list(query: AuctionListQuery): Promise<ListResult<AuctionRow>>;
  getById(id: string): Promise<AuctionDetail | null>;
  listBids(
    auctionId: string,
    pagination: Pagination,
  ): Promise<ListResult<BidEventRow>>;
}

export const createAuctionsService = defineService<AuctionsService>((ctx) => {
  const readChainAuction = async (id: string): Promise<AuctionRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const auction = (await readView(ctx, contract, 'auctionOf', [id])) as
      | OnChainAuction
      | undefined;
    if (auction === undefined || auction.exists !== true) return null;
    return jsonSafe({
      id,
      seller: auction.seller.toLowerCase(),
      highest_bid: auction.highestBid,
      highest_bidder: auction.highestBidder.toLowerCase(),
      end_time: auction.endTime,
      status: AUCTION_STATUSES[auction.status] ?? String(auction.status),
    }) as AuctionRow;
  };

  return {
    async list({
      pagination,
      seller,
      status,
    }): Promise<ListResult<AuctionRow>> {
      const filters = compactFilters({ seller, status });
      return pageRows<AuctionRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getById(id): Promise<AuctionDetail | null> {
      const row = await ctx.db.getBy<AuctionRow>(TABLE, 'id', id);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainAuction(id);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },

    async listBids(auctionId, pagination): Promise<ListResult<BidEventRow>> {
      return pageRows<BidEventRow>(ctx.db, {
        table: EVENTS_TABLE,
        pagination,
        filters: {
          group_name: GROUP,
          contract: CONTRACT,
          event_name: 'Bid',
          'args->>auctionId': auctionId,
        },
        order: { column: 'created_at', ascending: false },
      });
    },
  };
});
