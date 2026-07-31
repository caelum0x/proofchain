import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createInvoicesService } from '../../src/services/invoices.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const HOLDER = '0x1111111111111111111111111111111111111111';
const OBLIGOR = '0x6666666666666666666666666666666666666666';
const BATCH = `0x${'01'.repeat(32)}`;
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { batch_id: BATCH, token_id: '1', holder: HOLDER, obligor: OBLIGOR, face_value: '1000', due_date: '2100', status: 'funded', created_at: '2026-01-02' },
  { batch_id: `0x${'02'.repeat(32)}`, token_id: '2', holder: '0x2222222222222222222222222222222222222222', obligor: OBLIGOR, face_value: '500', due_date: '2101', status: 'registered', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('InvoicesService', () => {
  it('lists and filters by holder/obligor/status', async () => {
    const svc = createInvoicesService(makeCtx({ db: makeDb({ receivables: seed }) }));
    expect((await svc.list({ pagination: page })).total).toBe(2);
    const byObligor = await svc.list({ pagination: page, obligor: OBLIGOR, status: 'funded' });
    expect(byObligor.total).toBe(1);
    expect(byObligor.rows[0]?.batch_id).toBe(BATCH);
  });

  it('resolves detail by batchId DB-first then via receivableOf', async () => {
    const dbSvc = createInvoicesService(makeCtx({ db: makeDb({ receivables: seed }) }));
    expect(await dbSvc.getByBatchId(BATCH)).toMatchObject({ batch_id: BATCH, source: 'db' });

    const chain = makeChain({
      contracts: { ReceivableRegistry: true },
      reads: { receivableOf: { holder: HOLDER, obligor: OBLIGOR, faceValue: 12n, dueDate: 99n, status: 4, exists: true } },
    });
    const chainSvc = createInvoicesService(makeCtx({ db: makeDb({}), chain }));
    const detail = await chainSvc.getByBatchId(BATCH);
    expect(detail).toMatchObject({ status: 'settled', face_value: '12', source: 'chain' });
    expect(detail?.token_id).toBe(BigInt(BATCH).toString());
  });

  it('returns null when unknown', async () => {
    const svc = createInvoicesService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getByBatchId(BATCH)).toBeNull();
  });
});
