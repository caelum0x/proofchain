import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createMarketplaceService } from '../../src/services/marketplace.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const SELLER = '0x1111111111111111111111111111111111111111';
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { id: 'l1', seller: SELLER, kind: 'receivable', price: '1000', status: 'active', created_at: '2026-01-02' },
  { id: 'l2', seller: '0x2222222222222222222222222222222222222222', kind: 'nft', price: '500', status: 'filled', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('MarketplaceService', () => {
  it('lists newest-first and filters by seller/kind/status', async () => {
    const svc = createMarketplaceService(makeCtx({ db: makeDb({ listings: seed }) }));
    expect((await svc.list({ pagination: page })).rows[0]?.id).toBe('l1');
    const filtered = await svc.list({ pagination: page, kind: 'nft', status: 'filled' });
    expect(filtered.total).toBe(1);
    expect(filtered.rows[0]?.id).toBe('l2');
  });

  it('resolves detail DB-first then on-chain listingOf', async () => {
    const dbSvc = createMarketplaceService(makeCtx({ db: makeDb({ listings: seed }) }));
    expect(await dbSvc.getById('l1')).toMatchObject({ id: 'l1', source: 'db' });

    const chain = makeChain({
      contracts: { ListingRegistry: true },
      reads: { listingOf: { seller: SELLER, kind: 'bond', price: 42n, status: 1, exists: true } },
    });
    const chainSvc = createMarketplaceService(makeCtx({ db: makeDb({}), chain }));
    expect(await chainSvc.getById('l9')).toMatchObject({ status: 'cancelled', price: '42', source: 'chain' });
  });

  it('returns null when unknown', async () => {
    const svc = createMarketplaceService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getById('l9')).toBeNull();
  });
});
