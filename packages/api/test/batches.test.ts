import { describe, expect, it } from 'vitest';
import batchesPlugin from '../src/routes/batches.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const BATCH = `0x${'a'.repeat(64)}`;
const S1 = '0x1111111111111111111111111111111111111111';
const S2 = '0x2222222222222222222222222222222222222222';

const events: Row[] = [
  {
    event_name: 'BatchRegistered',
    args: { batchId: BATCH, supplier: S1, originHash: `0x${'e'.repeat(64)}`, metadataURI: 'ipfs://m1' },
    block_number: '20',
    tx_hash: `0x${'f'.repeat(64)}`,
  },
  {
    event_name: 'BatchRegistered',
    args: { batchId: `0x${'b'.repeat(64)}`, supplier: S2, originHash: `0x${'0'.repeat(64)}`, metadataURI: 'ipfs://m2' },
    block_number: '10',
    tx_hash: `0x${'1'.repeat(64)}`,
  },
  // Non-batch event must be ignored by the event_name column filter.
  { event_name: 'CheckpointAdded', args: { batchId: BATCH }, block_number: '30', tx_hash: `0x${'2'.repeat(64)}` },
];

describe('GET /batches', () => {
  it('projects BatchRegistered events, newest block first', async () => {
    const app = await buildApp(batchesPlugin, { db: makeDb({ indexer_events: events }) });
    const res = await app.inject({ method: 'GET', url: '/batches' });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ batchId: BATCH, supplier: S1, metadataURI: 'ipfs://m1' });
    expect(body.meta.total).toBe(2);
    await app.close();
  });
});

describe('GET /batches/search', () => {
  it('filters the projected batches by supplier', async () => {
    const app = await buildApp(batchesPlugin, { db: makeDb({ indexer_events: events }) });
    const res = await app.inject({ method: 'GET', url: `/batches/search?supplier=${S2}` });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].supplier).toBe(S2);
    await app.close();
  });
});

describe('GET /batches/:batchId', () => {
  it('reads the batch on-chain including checkpointCount (source=chain)', async () => {
    const chain = makeChain({
      contracts: { ProvenanceRegistry: true },
      reads: {
        getBatch: {
          batchId: BATCH,
          supplier: S1,
          originHash: `0x${'e'.repeat(64)}`,
          metadataURI: 'ipfs://m1',
          createdAt: 1699999999n,
          exists: true,
        },
        checkpointCount: 3n,
      },
    });
    const app = await buildApp(batchesPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/batches/${BATCH}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      checkpointCount: '3',
      createdAt: '1699999999',
      source: 'chain',
    });
    await app.close();
  });

  it('falls back to the indexed registration event when no contract (source=db)', async () => {
    const app = await buildApp(batchesPlugin, { db: makeDb({ indexer_events: events }) });
    const res = await app.inject({ method: 'GET', url: `/batches/${BATCH}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ batchId: BATCH, source: 'db' });
    await app.close();
  });

  it('404s for an unknown batch', async () => {
    const app = await buildApp(batchesPlugin, { db: makeDb({ indexer_events: [] }) });
    const res = await app.inject({ method: 'GET', url: `/batches/0x${'9'.repeat(64)}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
