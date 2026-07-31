import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createRewardsService } from '../../src/services/rewards.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { id: 'r1', account: ACCOUNT, program: 'loyalty', accrued: '100', claimed: '40', created_at: '2026-01-02' },
  { id: 'r2', account: ACCOUNT, program: 'staking', accrued: '50', claimed: '10', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('RewardsService', () => {
  it('lists and filters by account/program', async () => {
    const svc = createRewardsService(makeCtx({ db: makeDb({ rewards: seed }) }));
    expect((await svc.list({ pagination: page })).total).toBe(2);
    const staking = await svc.list({ pagination: page, program: 'staking' });
    expect(staking.total).toBe(1);
    expect(staking.rows[0]?.id).toBe('r2');
  });

  it('summarizes accrued/claimed/claimable across programs from the DB', async () => {
    const svc = createRewardsService(makeCtx({ db: makeDb({ rewards: seed }) }));
    const summary = await svc.summarize(ACCOUNT);
    expect(summary).toMatchObject({ accrued: '150', claimed: '50', claimable: '100', programs: 2 });
  });

  it('falls back to on-chain rewardsOf when nothing is indexed', async () => {
    const chain = makeChain({
      contracts: { RewardsDistributor: true },
      reads: { rewardsOf: { accrued: 80n, claimed: 30n, exists: true } },
    });
    const svc = createRewardsService(makeCtx({ db: makeDb({}), chain }));
    expect(await svc.summarize(ACCOUNT)).toMatchObject({ accrued: '80', claimable: '50' });
  });

  it('returns zeros when unknown to DB and chain', async () => {
    const svc = createRewardsService(makeCtx({ db: makeDb({}) }));
    expect(await svc.summarize(ACCOUNT)).toMatchObject({ accrued: '0', claimable: '0', programs: 0 });
  });
});
