/**
 * /analytics/finance route test. The plugin registers `/finance`; the
 * autoloader applies the `/analytics` directory prefix in production, but here
 * it is mounted un-prefixed (buildApp registers a single plugin).
 */
import { describe, expect, it } from 'vitest';
import financePlugin from '../../../src/routes/analytics/finance.js';
import { buildApp, makeDb, type Row } from '../../routers-kit.js';

const seeded: Record<string, readonly Row[]> = {
  financing_listings: [{ id: 'l1' }, { id: 'l2' }],
  receivables: [{ id: 'r1' }],
  pools: [{ id: 'p1' }],
  indexer_events: [{ id: 'e1', group_name: 'finance' }],
};

describe('analytics/finance router', () => {
  it('returns the finance domain drill-down', async () => {
    const app = await buildApp(financePlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/finance' });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.domain).toBe('finance');
    expect(data.events).toBe(1);
    expect(data.metrics).toEqual({ listings: 2, receivables: 1, pools: 1 });
    await app.close();
  });
});
