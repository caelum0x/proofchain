import { describe, expect, it } from 'vitest';
import bondsPlugin from '../src/routes/bonds.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const S1 = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x3333333333333333333333333333333333333333';

const bonds: Row[] = [
  { supplier: S1, token: TOKEN, amount: '5000', locked: '1000', status: 'active', updated_at: '2026-01-01' },
];

describe('GET /bonds', () => {
  it('lists bonds and filters by status', async () => {
    const app = await buildApp(bondsPlugin, { db: makeDb({ bonds }) });
    const active = await app.inject({ method: 'GET', url: '/bonds?status=active' });
    expect(active.json().data).toHaveLength(1);
    const slashed = await app.inject({ method: 'GET', url: '/bonds?status=slashed' });
    expect(slashed.json().data).toHaveLength(0);
    await app.close();
  });
});

describe('GET /bonds/:supplier', () => {
  it('reads bond amounts on-chain as decimal strings (source=chain)', async () => {
    const chain = makeChain({
      contracts: { SupplierBond: true },
      reads: {
        bondOf: 9000n,
        lockedOf: 2000n,
        unlockedOf: 7000n,
        bondTokenOf: TOKEN,
      },
    });
    const app = await buildApp(bondsPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/bonds/${S1}` });
    expect(res.json().data).toMatchObject({
      amount: '9000',
      locked: '2000',
      unlocked: '7000',
      token: TOKEN,
      status: 'active',
      source: 'chain',
    });
    await app.close();
  });

  it('returns a zeroed bond with source=unknown when unavailable', async () => {
    const app = await buildApp(bondsPlugin, { db: makeDb({}) });
    const res = await app.inject({ method: 'GET', url: `/bonds/${S1}` });
    expect(res.json().data).toMatchObject({ amount: '0', status: 'withdrawn', source: 'unknown' });
    await app.close();
  });
});
