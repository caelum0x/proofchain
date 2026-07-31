/**
 * /reports route tests — platform summary + per-domain report + validation.
 */
import { describe, expect, it } from 'vitest';
import reportsPlugin from '../../src/routes/reports.js';
import { buildApp, makeDb, type Row } from '../routers-kit.js';

const seeded: Record<string, readonly Row[]> = {
  suppliers: [{ id: 's1' }, { id: 's2' }],
  deals: [
    { id: 'd1', state: 'funded' },
    { id: 'd2', state: 'released' },
  ],
  financing_listings: [{ id: 'l1' }],
  indexer_events: [
    { id: 'e1', group_name: 'finance' },
    { id: 'e2', group_name: 'settlement' },
  ],
};

describe('reports router', () => {
  it('lists report domains', async () => {
    const app = await buildApp(reportsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/reports' });
    expect(res.json().data.domains).toContain('finance');
    await app.close();
  });

  it('returns a platform summary', async () => {
    const app = await buildApp(reportsPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/reports/summary' });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.totals.suppliers).toBe(2);
    expect(data.totals.deals).toBe(2);
    expect(data.finance.listings).toBe(1);
    await app.close();
  });

  it('returns a per-domain report', async () => {
    const app = await buildApp(reportsPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/reports/settlement' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.domain).toBe('settlement');
    expect(res.json().data.metrics.released).toBe(1);
    await app.close();
  });

  it('400s an unknown domain', async () => {
    const app = await buildApp(reportsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/reports/unknown' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
