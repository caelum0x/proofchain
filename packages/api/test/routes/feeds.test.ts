/**
 * /feeds route tests — JSON Feed + RSS syndication of a module group.
 */
import { describe, expect, it } from 'vitest';
import feedsPlugin from '../../src/routes/feeds.js';
import { buildApp, makeDb, type Row } from '../routers-kit.js';

const seeded: Record<string, readonly Row[]> = {
  indexer_events: [
    {
      id: 'e1',
      group_name: 'finance',
      contract: 'InvoiceFinancing',
      event_name: 'Listed',
      block_number: '10',
      args: { id: '1', amount: '1000' },
      created_at: '2026-01-02T00:00:00.000Z',
    },
    { id: 'e2', group_name: 'insurance', contract: 'X', event_name: 'Y', created_at: '2026-01-01' },
  ],
};

describe('feeds router', () => {
  it('lists feed groups', async () => {
    const app = await buildApp(feedsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/feeds' });
    expect(res.json().data.groups).toContain('finance');
    await app.close();
  });

  it('builds a JSON feed scoped to a group', async () => {
    const app = await buildApp(feedsPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/feeds/finance?format=json' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/feed+json');
    const feed = JSON.parse(res.body);
    expect(feed.version).toContain('jsonfeed.org');
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].title).toContain('Listed');
    await app.close();
  });

  it('builds an RSS feed', async () => {
    const app = await buildApp(feedsPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/feeds/finance?format=rss' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/rss+xml');
    expect(res.body).toContain('<rss version="2.0">');
    expect(res.body).toContain('<item>');
    await app.close();
  });

  it('400s an unknown group', async () => {
    const app = await buildApp(feedsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/feeds/not-a-group' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
