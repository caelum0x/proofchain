/**
 * /admin route tests — status, non-secret config projection, and table counts.
 */
import { describe, expect, it } from 'vitest';
import adminPlugin from '../../src/routes/admin.js';
import { buildApp, makeDb, type Row } from '../routers-kit.js';

describe('admin router', () => {
  it('reports status with a reachable chain and configured db', async () => {
    const app = await buildApp(adminPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/admin/status' });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.chain.reachable).toBe(true);
    expect(data.chain.blockNumber).toBe('1');
    expect(data.db.configured).toBe(true);
    expect(data.indexer.cursors).toBe(0);
    await app.close();
  });

  it('computes the indexer max block from cursors', async () => {
    const seeded: Record<string, readonly Row[]> = {
      indexer_cursors: [
        { key: 'A', last_block: '100' },
        { key: 'B', last_block: '250' },
      ],
    };
    const app = await buildApp(adminPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/admin/status' });
    expect(res.json().data.indexer.maxBlock).toBe('250');
    expect(res.json().data.indexer.cursors).toBe(2);
    await app.close();
  });

  it('exposes non-secret config only', async () => {
    const app = await buildApp(adminPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/admin/config' });
    const data = res.json().data;
    expect(data.chainId).toBe(11_155_111);
    expect(data.supabaseConfigured).toBe(false);
    expect(JSON.stringify(data)).not.toContain('SERVICE_ROLE');
    await app.close();
  });

  it('returns read-model table counts', async () => {
    const seeded: Record<string, readonly Row[]> = {
      suppliers: [{ id: 's1' }, { id: 's2' }],
    };
    const app = await buildApp(adminPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/admin/tables' });
    expect(res.json().data.suppliers).toBe(2);
    expect(res.json().data.deals).toBe(0);
    await app.close();
  });
});
