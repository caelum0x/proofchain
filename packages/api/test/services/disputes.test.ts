import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createDisputesService } from '../../src/services/disputes.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const OPENER = '0x1111111111111111111111111111111111111111';
const BATCH = `0x${'07'.repeat(32)}`;
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const disputes: Row[] = [
  { batch_id: BATCH, opener: OPENER, for_votes: 3, against_votes: 1, status: 'open', created_at: '2026-01-02' },
  { batch_id: `0x${'08'.repeat(32)}`, opener: '0x2222222222222222222222222222222222222222', for_votes: 2, against_votes: 5, status: 'resolved', created_at: '2026-01-01' },
];
const events: Row[] = [
  { group_name: 'governance', contract: 'DisputeArbitration', event_name: 'Voted', 'args->>batchId': BATCH, created_at: '2026-01-02' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('DisputesService', () => {
  it('lists and filters by status/opener', async () => {
    const svc = createDisputesService(makeCtx({ db: makeDb({ disputes }) }));
    expect((await svc.list({ pagination: page })).total).toBe(2);
    const open = await svc.list({ pagination: page, status: 'open' });
    expect(open.total).toBe(1);
    expect(open.rows[0]?.batch_id).toBe(BATCH);
  });

  it('resolves detail DB-first then via disputeOf', async () => {
    const dbSvc = createDisputesService(makeCtx({ db: makeDb({ disputes }) }));
    expect(await dbSvc.getByBatchId(BATCH)).toMatchObject({ batch_id: BATCH, source: 'db' });

    const chain = makeChain({
      contracts: { DisputeArbitration: true },
      reads: { disputeOf: { opener: OPENER, forVotes: 4, againstVotes: 0, resolved: false, exists: true } },
    });
    const chainSvc = createDisputesService(makeCtx({ db: makeDb({}), chain }));
    expect(await chainSvc.getByBatchId(BATCH)).toMatchObject({ status: 'open', for_votes: 4, source: 'chain' });
  });

  it('lists vote events scoped to a dispute', async () => {
    const svc = createDisputesService(makeCtx({ db: makeDb({ indexer_events: events }) }));
    expect((await svc.listVotes(BATCH, page)).total).toBe(1);
  });
});
