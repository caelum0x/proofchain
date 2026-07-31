import { describe, expect, it } from 'vitest';
import reputationPlugin from '../src/routes/reputation.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const S1 = '0x1111111111111111111111111111111111111111';
const S2 = '0x2222222222222222222222222222222222222222';

const reputation: Row[] = [
  { supplier: S1, avg_score_bps: 9000, total_deals: 10, pass_rate_bps: 8000, disputes: 1, grade: 2 },
  { supplier: S2, avg_score_bps: 5000, total_deals: 4, pass_rate_bps: 5000, disputes: 3, grade: 4 },
];

describe('GET /reputation', () => {
  it('returns a leaderboard ordered by avg_score_bps desc', async () => {
    const app = await buildApp(reputationPlugin, { db: makeDb({ reputation }) });
    const res = await app.inject({ method: 'GET', url: '/reputation' });
    const body = res.json();
    expect(body.data[0].supplier).toBe(S1);
    expect(body.data[1].supplier).toBe(S2);
    await app.close();
  });
});

describe('GET /reputation/:address', () => {
  it('maps the on-chain multi-return tuple and grade (source=chain)', async () => {
    const chain = makeChain({
      contracts: { ReputationEngine: true, ScoreOracle: true },
      reads: {
        reputationOf: [7200, 8n, 6600, 2n],
        gradeOf: 3,
      },
    });
    const app = await buildApp(reputationPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/reputation/${S1}` });
    expect(res.json().data).toMatchObject({
      avg_score_bps: 7200,
      total_deals: 8,
      pass_rate_bps: 6600,
      disputes: 2,
      grade: 3,
      source: 'chain',
    });
    await app.close();
  });

  it('returns a zeroed record with source=unknown when nothing is available', async () => {
    const app = await buildApp(reputationPlugin, { db: makeDb({}) });
    const res = await app.inject({ method: 'GET', url: `/reputation/${S2}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ avg_score_bps: 0, grade: null, source: 'unknown' });
    await app.close();
  });
});
