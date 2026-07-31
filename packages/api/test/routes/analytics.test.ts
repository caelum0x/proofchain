import { describe, expect, it } from 'vitest';
import analyticsPlugin from '../../src/routes/analytics.js';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';

const seedDb = () => {
  const db = createMemoryDb();
  db.seed('receivables', [{ batch_id: `0x${'1'.repeat(64)}`, created_at: '2026-01-01' }]);
  db.seed('policies', [
    { id: 'p1', created_at: '2026-01-01' },
    { id: 'p2', created_at: '2026-01-02' },
  ]);
  db.seed('indexer_events', [
    { group_name: 'finance', event_name: 'Listed', created_at: '2026-07-30T10:00:00.000Z' },
    { group_name: 'finance', event_name: 'Funded', created_at: '2026-07-30T12:00:00.000Z' },
    { group_name: 'settlement', event_name: 'Funded', created_at: '2026-07-31T09:00:00.000Z' },
  ]);
  return db;
};

describe('GET /analytics', () => {
  it('reports domain and per-group event counts', async () => {
    const app = await mountRouter(analyticsPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/analytics' });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.totals.indexedEvents).toBe(3);
    expect(data.domains.receivables).toBe(1);
    expect(data.domains.policies).toBe(2);
    expect(data.eventsByGroup.finance).toBe(2);
    expect(data.eventsByGroup.settlement).toBe(1);
    expect(data.eventsByGroup.governance).toBe(0);
    await app.close();
  });

  it('buckets events by UTC day in the timeseries', async () => {
    const app = await mountRouter(analyticsPlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/timeseries?days=90',
    });
    expect(res.statusCode).toBe(200);
    const series = res.json().data.series as Array<{ date: string; count: number }>;
    const day30 = series.find((s) => s.date === '2026-07-30');
    const day31 = series.find((s) => s.date === '2026-07-31');
    expect(day30?.count).toBe(2);
    expect(day31?.count).toBe(1);
    await app.close();
  });

  it('400s an out-of-range days param', async () => {
    const app = await mountRouter(analyticsPlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/timeseries?days=500',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});
