import { describe, expect, it } from 'vitest';
import lendersPlugin from '../../src/routes/lenders.js';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';

const LENDER_A = `0x${'a'.repeat(40)}`;
const LENDER_B = `0x${'b'.repeat(40)}`;
const BATCH = (n: string) => `0x${n.repeat(64)}`;

const seedDb = () => {
  const db = createMemoryDb();
  db.seed('financing_listings', [
    { batch_id: BATCH('1'), lender: LENDER_A, advance_amount: '1000', status: 'funded', created_at: '2026-01-03' },
    { batch_id: BATCH('2'), lender: LENDER_A, advance_amount: '2500', status: 'funded', created_at: '2026-01-02' },
    { batch_id: BATCH('3'), lender: LENDER_B, advance_amount: '400', status: 'funded', created_at: '2026-01-01' },
    { batch_id: BATCH('4'), lender: null, advance_amount: '999', status: 'listed', created_at: '2026-01-04' },
  ]);
  return db;
};

describe('GET /lenders', () => {
  it('aggregates funded listings per lender with summed advances', async () => {
    const app = await mountRouter(lendersPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/lenders' });
    expect(res.statusCode).toBe(200);
    const lenders = res.json().data as Array<{
      address: string;
      fundedCount: number;
      totalAdvanced: string;
    }>;
    const a = lenders.find((l) => l.address === LENDER_A);
    const b = lenders.find((l) => l.address === LENDER_B);
    expect(a).toBeDefined();
    expect(a?.fundedCount).toBe(2);
    expect(a?.totalAdvanced).toBe('3500'); // 1000 + 2500 via BigInt
    expect(b?.totalAdvanced).toBe('400');
    // the 'listed' row with null lender is excluded
    expect(lenders.some((l) => l.address === null)).toBe(false);
    await app.close();
  });

  it('summarizes a single lender by address', async () => {
    const app = await mountRouter(lendersPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: `/lenders/${LENDER_A}` });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.totalListings).toBe(2);
    expect(body.totalAdvanced).toBe('3500');
    await app.close();
  });

  it('400s a malformed lender address', async () => {
    const app = await mountRouter(lendersPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/lenders/0xnope' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});
