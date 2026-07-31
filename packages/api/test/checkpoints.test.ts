import { describe, expect, it } from 'vitest';
import checkpointsPlugin from '../src/routes/checkpoints.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const BATCH = `0x${'a'.repeat(64)}`;

// The indexer stamps every persisted event with its module `group_name`
// (see indexer/handlers/base.ts); both checkpoint sources live in `provenance`.
const events: Row[] = [
  { group_name: 'provenance', event_name: 'CheckpointAdded', args: { batchId: BATCH, location: 'Port A', dataHash: `0x${'1'.repeat(64)}` }, block_number: '10', tx_hash: `0x${'a'.repeat(64)}` },
  { group_name: 'provenance', event_name: 'CheckpointPushed', args: { batchId: BATCH, location: 'Port B', temp: '4', dataHash: `0x${'2'.repeat(64)}` }, block_number: '20', tx_hash: `0x${'b'.repeat(64)}` },
  { group_name: 'provenance', event_name: 'BatchRegistered', args: { batchId: BATCH }, block_number: '5', tx_hash: `0x${'c'.repeat(64)}` },
];

describe('GET /checkpoints', () => {
  it('returns a feed across both checkpoint event types, excluding others', async () => {
    const app = await buildApp(checkpointsPlugin, { db: makeDb({ indexer_events: events }) });
    const res = await app.inject({ method: 'GET', url: '/checkpoints' });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    const names = body.data.map((r: { event: string }) => r.event);
    expect(names).toContain('CheckpointAdded');
    expect(names).toContain('CheckpointPushed');
    await app.close();
  });
});

describe('GET /checkpoints/:batchId', () => {
  it('reads the ordered trail on-chain and stringifies timestamps', async () => {
    const chain = makeChain({
      contracts: { ProvenanceRegistry: true },
      reads: {
        getCheckpoints: [
          { batchId: BATCH, location: 'Origin', timestamp: 100n, dataHash: `0x${'3'.repeat(64)}` },
          { batchId: BATCH, location: 'Dest', timestamp: 200n, dataHash: `0x${'4'.repeat(64)}` },
        ],
      },
    });
    const app = await buildApp(checkpointsPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/checkpoints/${BATCH}` });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ location: 'Origin', timestamp: '100' });
    await app.close();
  });

  it('falls back to indexed events for the batch when the contract is unavailable', async () => {
    const app = await buildApp(checkpointsPlugin, { db: makeDb({ indexer_events: events }) });
    const res = await app.inject({ method: 'GET', url: `/checkpoints/${BATCH}` });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    await app.close();
  });

  it('400s on a malformed batchId', async () => {
    const app = await buildApp(checkpointsPlugin, { db: makeDb({}) });
    const res = await app.inject({ method: 'GET', url: '/checkpoints/xyz' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
