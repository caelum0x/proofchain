import { describe, expect, it } from 'vitest';
import invoicesPlugin from '../../src/routes/invoices.js';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';

const BATCH_A = `0x${'a'.repeat(64)}`;
const BATCH_B = `0x${'b'.repeat(64)}`;
const HOLDER = `0x${'1'.repeat(40)}`;
const OTHER = `0x${'2'.repeat(40)}`;

const seedDb = () => {
  const db = createMemoryDb();
  db.seed('receivables', [
    { batch_id: BATCH_A, holder: HOLDER, obligor: OTHER, status: 'funded', created_at: '2026-01-02' },
    { batch_id: BATCH_B, holder: OTHER, obligor: OTHER, status: 'registered', created_at: '2026-01-01' },
  ]);
  return db;
};

describe('GET /invoices', () => {
  it('lists receivables with pagination meta', async () => {
    const app = await mountRouter(invoicesPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/invoices' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    // newest-first by created_at
    expect(body.data[0].batch_id).toBe(BATCH_A);
    await app.close();
  });

  it('returns one receivable by batchId', async () => {
    const app = await mountRouter(invoicesPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: `/invoices/${BATCH_A}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.holder).toBe(HOLDER);
    await app.close();
  });

  it('404s an unknown batchId', async () => {
    const app = await mountRouter(invoicesPlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: `/invoices/0x${'c'.repeat(64)}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });

  it('400s a malformed batchId', async () => {
    const app = await mountRouter(invoicesPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/invoices/not-a-hash' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('filters by holder via search', async () => {
    const app = await mountRouter(invoicesPlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: `/invoices/search?holder=${HOLDER}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].batch_id).toBe(BATCH_A);
    await app.close();
  });
});
