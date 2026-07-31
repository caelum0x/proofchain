import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createClaimsService } from '../../src/services/claims.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const CLAIMANT = '0x1111111111111111111111111111111111111111';
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { id: 'c1', policy_id: 'p1', batch_id: null, claimant: CLAIMANT, amount: '90', status: 'filed', created_at: '2026-01-02' },
  { id: 'c2', policy_id: 'p2', batch_id: null, claimant: '0x2222222222222222222222222222222222222222', amount: '40', status: 'paid', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('ClaimsService', () => {
  it('lists newest-first and filters by claimant/status', async () => {
    const svc = createClaimsService(makeCtx({ db: makeDb({ claims: seed }) }));
    const all = await svc.list({ pagination: page });
    expect(all.total).toBe(2);
    expect(all.rows[0]?.id).toBe('c1');
    const filtered = await svc.list({ pagination: page, status: 'paid' });
    expect(filtered.total).toBe(1);
    expect(filtered.rows[0]?.id).toBe('c2');
  });

  it('resolves detail DB-first then on-chain claimOf', async () => {
    const dbSvc = createClaimsService(makeCtx({ db: makeDb({ claims: seed }) }));
    expect(await dbSvc.getById('c1')).toMatchObject({ id: 'c1', source: 'db' });

    const chain = makeChain({
      contracts: { ClaimsProcessor: true },
      reads: { claimOf: { policyId: 'p3', claimant: CLAIMANT, amount: 12n, status: 1, exists: true } },
    });
    const chainSvc = createClaimsService(makeCtx({ db: makeDb({}), chain }));
    expect(await chainSvc.getById('c9')).toMatchObject({ status: 'approved', amount: '12', source: 'chain' });
  });

  it('returns null when unknown', async () => {
    const svc = createClaimsService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getById('c9')).toBeNull();
  });
});
