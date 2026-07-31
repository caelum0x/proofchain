import { describe, expect, it } from 'vitest';
import governancePlugin from '../../src/routes/governance.js';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';

const VOTER = `0x${'d'.repeat(40)}`;
const OTHER = `0x${'e'.repeat(40)}`;

const seedDb = () => {
  const db = createMemoryDb();
  db.seed('proposals', [
    { id: '1', state: 'active', proposer: VOTER, created_at: '2026-01-02' },
    { id: '2', state: 'executed', proposer: OTHER, created_at: '2026-01-01' },
  ]);
  db.seed('votes', [
    { id: '1:voterA', proposal_id: '1', voter: VOTER, support: 1, created_at: '2026-01-03' },
    { id: '1:voterB', proposal_id: '1', voter: OTHER, support: 0, created_at: '2026-01-02' },
    { id: '2:voterA', proposal_id: '2', voter: VOTER, support: 2, created_at: '2026-01-01' },
  ]);
  return db;
};

describe('governance router', () => {
  it('lists proposals with meta', async () => {
    const app = await mountRouter(governancePlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/governance/proposals' });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.total).toBe(2);
    await app.close();
  });

  it('returns a proposal detail and 404s unknown ids', async () => {
    const app = await mountRouter(governancePlugin, makeContext(seedDb()));
    const ok = await app.inject({ method: 'GET', url: '/governance/proposals/1' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.state).toBe('active');
    const missing = await app.inject({ method: 'GET', url: '/governance/proposals/999' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('lists the votes for one proposal', async () => {
    const app = await mountRouter(governancePlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/governance/proposals/1/votes' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
    await app.close();
  });

  it('filters votes by voter across proposals', async () => {
    const app = await mountRouter(governancePlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: `/governance/votes?voter=${VOTER}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
    await app.close();
  });
});
