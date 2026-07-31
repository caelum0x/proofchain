import { describe, expect, it } from 'vitest';
import dealsPlugin from '../src/routes/deals.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const BATCH = `0x${'a'.repeat(64)}`;
const BATCH2 = `0x${'b'.repeat(64)}`;
const BUYER = '0x1111111111111111111111111111111111111111';
const SUPPLIER = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x3333333333333333333333333333333333333333';

const deals: Row[] = [
  { batch_id: BATCH, buyer: BUYER, supplier: SUPPLIER, token: TOKEN, amount: '1000', state: 'funded', tx_hash: null, updated_at: '2026-01-02' },
  { batch_id: BATCH2, buyer: BUYER, supplier: SUPPLIER, token: TOKEN, amount: '2000', state: 'released', tx_hash: null, updated_at: '2026-01-01' },
];

describe('GET /deals', () => {
  it('lists deals with meta', async () => {
    const app = await buildApp(dealsPlugin, { db: makeDb({ deals }) });
    const res = await app.inject({ method: 'GET', url: '/deals' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
    expect(res.json().meta.total).toBe(2);
    await app.close();
  });

  it('filters by state', async () => {
    const app = await buildApp(dealsPlugin, { db: makeDb({ deals }) });
    const res = await app.inject({ method: 'GET', url: '/deals?state=released' });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].batch_id).toBe(BATCH2);
    await app.close();
  });

  it('rejects an invalid state enum with 400', async () => {
    const app = await buildApp(dealsPlugin, { db: makeDb({ deals }) });
    const res = await app.inject({ method: 'GET', url: '/deals?state=bogus' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /deals/:batchId', () => {
  it('returns the indexed deal (source=db)', async () => {
    const app = await buildApp(dealsPlugin, { db: makeDb({ deals }) });
    const res = await app.inject({ method: 'GET', url: `/deals/${BATCH}` });
    expect(res.json().data).toMatchObject({ batch_id: BATCH, source: 'db' });
    await app.close();
  });

  it('falls back to on-chain getDeal, mapping enum state and payee override', async () => {
    const chain = makeChain({
      contracts: { SettlementEscrow: true },
      reads: {
        getDeal: { batchId: BATCH, buyer: BUYER, supplier: SUPPLIER, token: TOKEN, amount: 4200n, state: 4 },
        payeeOverride: '0x0000000000000000000000000000000000000000',
      },
    });
    const app = await buildApp(dealsPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/deals/${BATCH}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      amount: '4200',
      state: 'disputed',
      payee: null,
      source: 'chain',
    });
    await app.close();
  });

  it('404s for an unfunded (state None) on-chain deal', async () => {
    const chain = makeChain({
      contracts: { SettlementEscrow: true },
      reads: {
        getDeal: { batchId: BATCH, buyer: BUYER, supplier: SUPPLIER, token: TOKEN, amount: 0n, state: 0 },
      },
    });
    const app = await buildApp(dealsPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/deals/${BATCH}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
