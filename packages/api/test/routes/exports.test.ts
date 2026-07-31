/**
 * /exports route tests — JSON envelope + CSV attachment + whitelist enforcement.
 */
import { describe, expect, it } from 'vitest';
import exportsPlugin from '../../src/routes/exports.js';
import { buildApp, makeDb, type Row } from '../routers-kit.js';

const seeded: Record<string, readonly Row[]> = {
  suppliers: [
    { address: '0xaaa', name: 'Acme, Inc', org_id: 'o1', created_at: '2026-01-02' },
    { address: '0xbbb', name: 'Beta "Co"', org_id: 'o2', created_at: '2026-01-01' },
  ],
};

describe('exports router', () => {
  it('lists exportable resources', async () => {
    const app = await buildApp(exportsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/exports' });
    expect(res.json().data.resources).toContain('suppliers');
    await app.close();
  });

  it('exports JSON in the standard envelope', async () => {
    const app = await buildApp(exportsPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/exports/suppliers?format=json' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.resource).toBe('suppliers');
    expect(res.json().data.rows).toHaveLength(2);
    await app.close();
  });

  it('exports CSV as a downloadable attachment with escaped fields', async () => {
    const app = await buildApp(exportsPlugin, { db: makeDb(seeded) });
    const res = await app.inject({ method: 'GET', url: '/exports/suppliers?format=csv' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('suppliers.csv');
    expect(res.body).toContain('address');
    // Comma + quotes are RFC-4180 escaped.
    expect(res.body).toContain('"Acme, Inc"');
    expect(res.body).toContain('"Beta ""Co"""');
    await app.close();
  });

  it('400s a non-whitelisted resource', async () => {
    const app = await buildApp(exportsPlugin, { db: makeDb() });
    const res = await app.inject({ method: 'GET', url: '/exports/secrets' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});
