import { describe, expect, it } from 'vitest';
import suppliersPlugin from '../src/routes/suppliers.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const A1 = '0x1111111111111111111111111111111111111111';
const A2 = '0x2222222222222222222222222222222222222222';

const seedRows: Row[] = [
  { address: A1, name: 'Acme Steel', uri: 'ipfs://a', org_id: 'org1', created_at: '2026-01-02' },
  { address: A2, name: 'Beta Foods', uri: 'ipfs://b', org_id: 'org2', created_at: '2026-01-01' },
];

describe('GET /suppliers', () => {
  it('lists suppliers with pagination meta and newest-first order', async () => {
    const app = await buildApp(suppliersPlugin, { db: makeDb({ suppliers: seedRows }) });
    const res = await app.inject({ method: 'GET', url: '/suppliers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].address).toBe(A1); // created_at desc
    expect(body.meta).toEqual({ total: 2, limit: 25, offset: 0 });
    await app.close();
  });

  it('filters the list by org_id', async () => {
    const app = await buildApp(suppliersPlugin, { db: makeDb({ suppliers: seedRows }) });
    const res = await app.inject({ method: 'GET', url: '/suppliers?org_id=org2' });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].address).toBe(A2);
    expect(body.meta.total).toBe(1);
    await app.close();
  });
});

describe('GET /suppliers/search', () => {
  it('matches on name substring, case-insensitively', async () => {
    const app = await buildApp(suppliersPlugin, { db: makeDb({ suppliers: seedRows }) });
    const res = await app.inject({ method: 'GET', url: '/suppliers/search?q=steel' });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Acme Steel');
    await app.close();
  });
});

describe('GET /suppliers/:address', () => {
  it('rejects a malformed address with 400', async () => {
    const app = await buildApp(suppliersPlugin, { db: makeDb({ suppliers: seedRows }) });
    const res = await app.inject({ method: 'GET', url: '/suppliers/not-an-address' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('returns the indexed row when present (source=db)', async () => {
    const app = await buildApp(suppliersPlugin, { db: makeDb({ suppliers: seedRows }) });
    const res = await app.inject({ method: 'GET', url: `/suppliers/${A1}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.source).toBe('db');
    expect(res.json().data.name).toBe('Acme Steel');
    await app.close();
  });

  it('falls back to an on-chain profileOf read when not indexed (source=chain)', async () => {
    const chain = makeChain({
      contracts: { SupplierRegistry: true },
      reads: {
        profileOf: { account: A2, name: 'OnChain Co', uri: 'ipfs://x', registeredAt: 5n, exists: true },
      },
    });
    const app = await buildApp(suppliersPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/suppliers/${A2}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ name: 'OnChain Co', source: 'chain' });
    await app.close();
  });

  it('404s when neither the DB nor a deployed contract has the supplier', async () => {
    const app = await buildApp(suppliersPlugin, { db: makeDb({}) });
    const res = await app.inject({ method: 'GET', url: `/suppliers/${A2}` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });

  it('404s when the on-chain profile does not exist', async () => {
    const chain = makeChain({
      contracts: { SupplierRegistry: true },
      reads: { profileOf: { account: A2, name: '', uri: '', registeredAt: 0n, exists: false } },
    });
    const app = await buildApp(suppliersPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/suppliers/${A2}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
