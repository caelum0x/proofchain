import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createBondsService } from '../../src/services/bonds.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const S1 = '0x1111111111111111111111111111111111111111';
const S2 = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x7777777777777777777777777777777777777777';
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { supplier: S1, token: TOKEN, amount: '1000', locked: '200', status: 'active', updated_at: '2026-01-02' },
  { supplier: S2, token: TOKEN, amount: '0', locked: '0', status: 'withdrawn', updated_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('BondsService', () => {
  it('lists newest-first and filters by status', async () => {
    const svc = createBondsService(makeCtx({ db: makeDb({ bonds: seed }) }));
    expect((await svc.list({ pagination: page })).rows[0]?.supplier).toBe(S1);
    const active = await svc.list({ pagination: page, status: 'active' });
    expect(active.total).toBe(1);
  });

  it('resolves a bond DB-first with source=db', async () => {
    const svc = createBondsService(makeCtx({ db: makeDb({ bonds: seed }) }));
    expect(await svc.getBySupplier(S1)).toMatchObject({ supplier: S1, amount: '1000', source: 'db' });
  });

  it('falls back to on-chain bond views with source=chain', async () => {
    const chain = makeChain({
      contracts: { SupplierBond: true },
      reads: {
        bondOf: 500n,
        lockedOf: 100n,
        unlockedOf: 400n,
        bondTokenOf: TOKEN,
      },
    });
    const svc = createBondsService(makeCtx({ db: makeDb({}), chain }));
    expect(await svc.getBySupplier(S1)).toMatchObject({
      amount: '500',
      locked: '100',
      unlocked: '400',
      token: TOKEN,
      status: 'active',
      source: 'chain',
    });
  });

  it('returns zeros with source=unknown when nothing is known', async () => {
    const svc = createBondsService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getBySupplier(S1)).toMatchObject({ amount: '0', source: 'unknown' });
  });
});
