import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createPoolsService } from '../../src/services/pools.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const MANAGER = '0x1111111111111111111111111111111111111111';
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { id: 'pool1', manager: MANAGER, total_assets: '1000', total_shares: '1000', risk_grade: 2, created_at: '2026-01-02' },
  { id: 'pool2', manager: '0x2222222222222222222222222222222222222222', total_assets: '5', total_shares: '5', risk_grade: 5, created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('PoolsService', () => {
  it('lists and filters by manager/grade', async () => {
    const svc = createPoolsService(makeCtx({ db: makeDb({ pools: seed }) }));
    expect((await svc.list({ pagination: page })).total).toBe(2);
    const graded = await svc.list({ pagination: page, grade: 5 });
    expect(graded.total).toBe(1);
    expect(graded.rows[0]?.id).toBe('pool2');
  });

  it('resolves detail DB-first then via poolOf', async () => {
    const dbSvc = createPoolsService(makeCtx({ db: makeDb({ pools: seed }) }));
    expect(await dbSvc.getById('pool1')).toMatchObject({ id: 'pool1', source: 'db' });

    const chain = makeChain({
      contracts: { FinancingPool: true },
      reads: { poolOf: { manager: MANAGER, totalAssets: 9n, totalShares: 8n, riskGrade: 3, exists: true } },
    });
    const chainSvc = createPoolsService(makeCtx({ db: makeDb({}), chain }));
    expect(await chainSvc.getById('pool9')).toMatchObject({ total_assets: '9', risk_grade: 3, source: 'chain' });
  });

  it('returns null when unknown', async () => {
    const svc = createPoolsService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getById('pool9')).toBeNull();
  });
});
