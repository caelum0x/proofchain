import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createAuctionsService } from '../../src/services/auctions.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const SELLER = '0x1111111111111111111111111111111111111111';
const BIDDER = '0x4444444444444444444444444444444444444444';
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const auctions: Row[] = [
  { id: 'a1', seller: SELLER, highest_bid: '100', highest_bidder: BIDDER, end_time: '1900', status: 'active', created_at: '2026-01-02' },
  { id: 'a2', seller: '0x2222222222222222222222222222222222222222', highest_bid: '0', highest_bidder: null, end_time: '1800', status: 'cancelled', created_at: '2026-01-01' },
];
const events: Row[] = [
  { group_name: 'marketplace', contract: 'AuctionHouse', event_name: 'Bid', 'args->>auctionId': 'a1', created_at: '2026-01-02' },
  { group_name: 'marketplace', contract: 'AuctionHouse', event_name: 'Bid', 'args->>auctionId': 'a2', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('AuctionsService', () => {
  it('lists and filters by status/seller', async () => {
    const svc = createAuctionsService(makeCtx({ db: makeDb({ auctions }) }));
    expect((await svc.list({ pagination: page })).rows[0]?.id).toBe('a1');
    const active = await svc.list({ pagination: page, status: 'active' });
    expect(active.total).toBe(1);
  });

  it('resolves detail DB-first then via auctionOf', async () => {
    const dbSvc = createAuctionsService(makeCtx({ db: makeDb({ auctions }) }));
    expect(await dbSvc.getById('a1')).toMatchObject({ id: 'a1', source: 'db' });

    const chain = makeChain({
      contracts: { AuctionHouse: true },
      reads: { auctionOf: { seller: SELLER, highestBid: 5n, highestBidder: BIDDER, endTime: 42n, status: 1, exists: true } },
    });
    const chainSvc = createAuctionsService(makeCtx({ db: makeDb({}), chain }));
    expect(await chainSvc.getById('a9')).toMatchObject({ status: 'settled', highest_bid: '5', source: 'chain' });
  });

  it('lists bid events scoped to an auction', async () => {
    const svc = createAuctionsService(makeCtx({ db: makeDb({ indexer_events: events }) }));
    const bids = await svc.listBids('a1', page);
    expect(bids.total).toBe(1);
  });
});
