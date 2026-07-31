import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createFinancingService } from '../../src/services/financing.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const SUPPLIER = '0x1111111111111111111111111111111111111111';
const LENDER = '0x5555555555555555555555555555555555555555';
const BATCH = `0x${'cd'.repeat(32)}`;
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { batch_id: BATCH, supplier: SUPPLIER, lender: LENDER, face_value: '1000', discount_bps: 250, status: 'funded', created_at: '2026-01-02' },
  { batch_id: `0x${'ee'.repeat(32)}`, supplier: '0x2222222222222222222222222222222222222222', lender: null, face_value: '500', discount_bps: 300, status: 'listed', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('FinancingService', () => {
  it('lists and filters by supplier/status', async () => {
    const svc = createFinancingService(makeCtx({ db: makeDb({ financing_listings: seed }) }));
    expect((await svc.list({ pagination: page })).total).toBe(2);
    const funded = await svc.list({ pagination: page, status: 'funded' });
    expect(funded.total).toBe(1);
    expect(funded.rows[0]?.supplier).toBe(SUPPLIER);
  });

  it('resolves detail by batchId DB-first then via listingOf', async () => {
    const dbSvc = createFinancingService(makeCtx({ db: makeDb({ financing_listings: seed }) }));
    expect(await dbSvc.getByBatchId(BATCH)).toMatchObject({ batch_id: BATCH, source: 'db' });

    const chain = makeChain({
      contracts: { InvoiceFinancing: true },
      reads: { listingOf: { supplier: SUPPLIER, lender: '0x0000000000000000000000000000000000000000', faceValue: 7n, discountBps: 100, status: 0, exists: true } },
    });
    const chainSvc = createFinancingService(makeCtx({ db: makeDb({}), chain }));
    const detail = await chainSvc.getByBatchId(BATCH);
    expect(detail).toMatchObject({ status: 'listed', lender: null, face_value: '7', source: 'chain' });
  });

  it('returns null when unknown', async () => {
    const svc = createFinancingService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getByBatchId(BATCH)).toBeNull();
  });
});
