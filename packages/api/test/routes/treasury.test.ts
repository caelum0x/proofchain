import { describe, expect, it } from 'vitest';
import treasuryPlugin from '../../src/routes/treasury.js';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';

const seedDb = () => {
  const db = createMemoryDb();
  db.seed('indexer_events', [
    { group_name: 'settlement', contract: 'Treasury', event_name: 'Deposit', args: { amount: '5000' }, created_at: '2026-01-01' },
    { group_name: 'settlement', contract: 'Treasury', event_name: 'Deposit', args: { amount: '3000' }, created_at: '2026-01-02' },
    { group_name: 'settlement', contract: 'Treasury', event_name: 'Withdraw', args: { amount: '2000' }, created_at: '2026-01-03' },
    // noise from another contract must not affect the balance
    { group_name: 'settlement', contract: 'FeeManager', event_name: 'FeeCollected', args: { amount: '9999' }, created_at: '2026-01-04' },
  ]);
  return db;
};

describe('GET /treasury', () => {
  it('computes net balance from Deposit/Withdraw events', async () => {
    const app = await mountRouter(treasuryPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/treasury' });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.deposited).toBe('8000');
    expect(data.withdrawn).toBe('2000');
    expect(data.netBalance).toBe('6000');
    await app.close();
  });

  it('lists only deposit events on /treasury/deposits', async () => {
    const app = await mountRouter(treasuryPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/treasury/deposits' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data.every((e: { event_name: string }) => e.event_name === 'Deposit')).toBe(true);
    await app.close();
  });
});
