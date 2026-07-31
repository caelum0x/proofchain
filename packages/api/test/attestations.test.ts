import { describe, expect, it } from 'vitest';
import attestationsPlugin from '../src/routes/attestations.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const BATCH = `0x${'c'.repeat(64)}`;
const AGENT = '0x4444444444444444444444444444444444444444';

const verdicts: Row[] = [
  { batch_id: BATCH, score: 9600, passed: true, threshold: 7000, verdict_hash: `0x${'1'.repeat(64)}`, verdict_uri: 'ipfs://v', model: 'claude', created_at: '2026-01-01' },
  { batch_id: `0x${'d'.repeat(64)}`, score: 4000, passed: false, threshold: 7000, verdict_hash: `0x${'2'.repeat(64)}`, verdict_uri: null, model: 'claude', created_at: '2026-01-02' },
];

describe('GET /attestations', () => {
  it('lists verdicts and filters by passed=true', async () => {
    const app = await buildApp(attestationsPlugin, { db: makeDb({ verdicts }) });
    const res = await app.inject({ method: 'GET', url: '/attestations?passed=true' });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].batch_id).toBe(BATCH);
    await app.close();
  });
});

describe('GET /attestations/search', () => {
  it('applies the minScore in-memory refinement', async () => {
    const app = await buildApp(attestationsPlugin, { db: makeDb({ verdicts }) });
    const res = await app.inject({ method: 'GET', url: '/attestations/search?minScore=5000' });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].score).toBe(9600);
    await app.close();
  });
});

describe('GET /attestations/:batchId', () => {
  it('reads the on-chain attestation first (source=chain) and serializes bigints', async () => {
    const chain = makeChain({
      contracts: { AttestationRegistry: true },
      reads: {
        getAttestation: {
          batchId: BATCH,
          score: 8800,
          verdictHash: `0x${'9'.repeat(64)}`,
          verdictURI: 'ipfs://onchain',
          attestedAt: 1700000000n,
          agent: AGENT,
          exists: true,
        },
      },
    });
    const app = await buildApp(attestationsPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/attestations/${BATCH}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      score: 8800,
      attestedAt: '1700000000',
      agent: AGENT,
      source: 'chain',
    });
    await app.close();
  });

  it('falls back to the verdicts mirror when the contract is unavailable (source=db)', async () => {
    const app = await buildApp(attestationsPlugin, { db: makeDb({ verdicts }) });
    const res = await app.inject({ method: 'GET', url: `/attestations/${BATCH}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.source).toBe('db');
    await app.close();
  });

  it('404s when neither chain nor DB has the attestation', async () => {
    const app = await buildApp(attestationsPlugin, { db: makeDb({}) });
    const res = await app.inject({ method: 'GET', url: `/attestations/${BATCH}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
