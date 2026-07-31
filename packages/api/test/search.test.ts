import { describe, expect, it } from 'vitest';
import searchPlugin from '../src/routes/search.js';
import { buildApp, makeDb, type Row } from './routers-kit.js';

const BATCH = `0x${'a'.repeat(64)}`;
const ADDR = '0x1111111111111111111111111111111111111111';

const suppliers: Row[] = [{ address: ADDR, name: 'Acme Steel' }];
const deals: Row[] = [{ batch_id: BATCH, buyer: ADDR, supplier: ADDR, amount: '1', state: 'funded' }];

describe('GET /search', () => {
  it('classifies a 32-byte hex as a batchId and gathers batch resources', async () => {
    const app = await buildApp(searchPlugin, { db: makeDb({ deals }) });
    const res = await app.inject({ method: 'GET', url: `/search?q=${BATCH}` });
    const body = res.json();
    expect(body.data.kind).toBe('batchId');
    expect(body.data.results.deal.batch_id).toBe(BATCH);
    expect(body.data.results.verdict).toBeNull();
    await app.close();
  });

  it('classifies a 20-byte hex as an address and probes identity registries', async () => {
    const app = await buildApp(searchPlugin, { db: makeDb({ suppliers }) });
    const res = await app.inject({ method: 'GET', url: `/search?q=${ADDR}` });
    const body = res.json();
    expect(body.data.kind).toBe('address');
    expect(body.data.results.supplier.name).toBe('Acme Steel');
    expect(body.data.results.buyer).toBeNull();
    await app.close();
  });

  it('treats other input as a name search across identity read models', async () => {
    const app = await buildApp(searchPlugin, { db: makeDb({ suppliers }) });
    const res = await app.inject({ method: 'GET', url: '/search?q=acme' });
    const body = res.json();
    expect(body.data.kind).toBe('text');
    expect(body.data.results.suppliers).toHaveLength(1);
    await app.close();
  });

  it('400s when q is missing', async () => {
    const app = await buildApp(searchPlugin, { db: makeDb({}) });
    const res = await app.inject({ method: 'GET', url: '/search' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
