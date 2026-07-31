/**
 * /subscriptions route tests — SSE snapshot framing + channel validation.
 */
import { describe, expect, it } from 'vitest';
import subscriptionsPlugin from '../../src/routes/subscriptions.js';
import { buildApp, makeDb, type Row } from '../routers-kit.js';

const seeded: Record<string, readonly Row[]> = {
  indexer_events: [
    { id: 'e1', group_name: 'finance', event_name: 'Listed', args: { id: '1' }, created_at: '2026-01-02' },
    { id: 'e2', group_name: 'finance', event_name: 'Funded', args: { id: '2' }, created_at: '2026-01-01' },
  ],
};

describe('subscriptions router', () => {
  it('lists channels', async () => {
    const app = await buildApp(subscriptionsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/subscriptions' });
    expect(res.json().data.channels).toContain('events');
    expect(res.json().data.channels).toContain('notifications');
    await app.close();
  });

  it('streams an SSE snapshot for a group channel', async () => {
    const app = await buildApp(subscriptionsPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/subscriptions/finance' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('event: Listed');
    expect(res.body).toContain('id: e1');
    // Terminated by a ping frame carrying the count.
    expect(res.body).toContain('event: ping');
    expect(res.body).toContain('"count":2');
    await app.close();
  });

  it('400s an unknown channel', async () => {
    const app = await buildApp(subscriptionsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/subscriptions/bogus' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
