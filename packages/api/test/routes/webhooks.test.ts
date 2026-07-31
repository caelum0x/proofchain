/**
 * /webhooks route tests — registration + read surface over an in-memory Db.
 */
import { describe, expect, it } from 'vitest';
import webhooksPlugin from '../../src/routes/webhooks.js';
import { buildApp, makeDb, type Row } from '../routers-kit.js';

const ID = '11111111-1111-1111-1111-111111111111';

const seeded: Record<string, readonly Row[]> = {
  webhooks: [
    { id: ID, url: 'https://hook.example/a', events: ['Funded'], active: true, created_at: '2026-01-02' },
  ],
  webhook_deliveries: [
    { id: 'd1', webhook_id: ID, event: 'Funded', status: 'ok', response_code: 200, created_at: '2026-01-03' },
  ],
};

describe('webhooks router', () => {
  it('registers a webhook', async () => {
    const app = await buildApp(webhooksPlugin, { db: makeDb() });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks',
      payload: { url: 'https://hook.example/x', events: ['Released'] },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.url).toBe('https://hook.example/x');
    expect(data.events).toEqual(['Released']);
    expect(typeof data.id).toBe('string');
    expect(data.active).toBe(true);
    await app.close();
  });

  it('400s an invalid registration', async () => {
    const app = await buildApp(webhooksPlugin, { db: makeDb() });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks',
      payload: { url: 'not-a-url', events: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('lists, fetches one, and pages deliveries', async () => {
    const app = await buildApp(webhooksPlugin, { db: makeDb(seeded) });

    const list = await app.inject({ method: 'GET', url: '/webhooks' });
    expect(list.json().data).toHaveLength(1);

    const one = await app.inject({ method: 'GET', url: `/webhooks/${ID}` });
    expect(one.json().data.url).toBe('https://hook.example/a');

    const deliveries = await app.inject({
      method: 'GET',
      url: `/webhooks/${ID}/deliveries`,
    });
    expect(deliveries.json().data).toHaveLength(1);
    await app.close();
  });

  it('404s an unknown webhook', async () => {
    const app = await buildApp(webhooksPlugin, { db: makeDb() });
    const res = await app.inject({
      method: 'GET',
      url: '/webhooks/22222222-2222-2222-2222-222222222222',
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
