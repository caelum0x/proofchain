import { describe, expect, it } from 'vitest';
import paymentsPlugin from '../../src/routes/payments.js';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';

const PAYER = `0x${'a'.repeat(40)}`;
const OTHER = `0x${'b'.repeat(40)}`;
const TOKEN = `0x${'c'.repeat(40)}`;
const TX = `0x${'f'.repeat(64)}`;

const seedDb = () => {
  const db = createMemoryDb();
  db.seed('indexer_events', [
    { group_name: 'settlement', contract: 'PaymentRouter', event_name: 'Routed', args: { payer: PAYER, token: TOKEN }, tx_hash: TX, created_at: '2026-01-03' },
    { group_name: 'settlement', contract: 'PaymentRouter', event_name: 'Routed', args: { payer: OTHER, token: TOKEN }, tx_hash: `0x${'e'.repeat(64)}`, created_at: '2026-01-02' },
    { group_name: 'settlement', contract: 'FeeManager', event_name: 'FeeCollected', args: { amount: '10' }, tx_hash: TX, created_at: '2026-01-03' },
  ]);
  return db;
};

describe('payments router', () => {
  it('lists routed payments', async () => {
    const app = await mountRouter(paymentsPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/payments' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
    await app.close();
  });

  it('filters routed payments by payer (args JSON path)', async () => {
    const app = await mountRouter(paymentsPlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: `/payments/search?payer=${PAYER}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].args.payer).toBe(PAYER);
    await app.close();
  });

  it('returns all settlement events in one transaction', async () => {
    const app = await mountRouter(paymentsPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: `/payments/${TX}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2); // Routed + FeeCollected share TX
    await app.close();
  });

  it('400s a malformed tx hash', async () => {
    const app = await mountRouter(paymentsPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/payments/0x123' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});
