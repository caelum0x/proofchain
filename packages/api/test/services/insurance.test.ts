import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createInsuranceService } from '../../src/services/insurance.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const HOLDER = '0x1111111111111111111111111111111111111111';
const BATCH = `0x${'ab'.repeat(32)}`;
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { id: 'p1', holder: HOLDER, batch_id: BATCH, premium: '10', payout: '100', status: 'active', created_at: '2026-01-02' },
  { id: 'p2', holder: '0x2222222222222222222222222222222222222222', batch_id: BATCH, premium: '5', payout: '50', status: 'expired', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('InsuranceService.list', () => {
  it('returns policies newest-first with a total', async () => {
    const svc = createInsuranceService(makeCtx({ db: makeDb({ policies: seed }) }));
    const { rows, total } = await svc.list({ pagination: page });
    expect(total).toBe(2);
    expect(rows[0]?.id).toBe('p1');
  });

  it('filters by holder and status', async () => {
    const svc = createInsuranceService(makeCtx({ db: makeDb({ policies: seed }) }));
    const { rows, total } = await svc.list({ pagination: page, holder: HOLDER, status: 'active' });
    expect(total).toBe(1);
    expect(rows[0]?.id).toBe('p1');
  });
});

describe('InsuranceService.getById', () => {
  it('resolves DB-first with source=db', async () => {
    const svc = createInsuranceService(makeCtx({ db: makeDb({ policies: seed }) }));
    expect(await svc.getById('p1')).toMatchObject({ id: 'p1', source: 'db' });
  });

  it('falls back to on-chain policyOf with source=chain', async () => {
    const chain = makeChain({
      contracts: { PolicyManager: true },
      reads: { policyOf: { holder: HOLDER, batchId: BATCH, premium: 7n, payout: 70n, status: 3, exists: true } },
    });
    const svc = createInsuranceService(makeCtx({ db: makeDb({}), chain }));
    const detail = await svc.getById('p9');
    expect(detail).toMatchObject({ id: 'p9', status: 'cancelled', premium: '7', source: 'chain' });
  });

  it('returns null when unknown to DB and no deployed contract', async () => {
    const svc = createInsuranceService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getById('p9')).toBeNull();
  });
});
