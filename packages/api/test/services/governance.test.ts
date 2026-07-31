import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createGovernanceService } from '../../src/services/governance.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const PROPOSER = '0x1111111111111111111111111111111111111111';
const VOTER = '0x3333333333333333333333333333333333333333';
const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const proposals: Row[] = [
  { id: '1', proposer: PROPOSER, description: 'raise fee', state: 'active', for_votes: '10', against_votes: '2', created_at: '2026-01-02' },
  { id: '2', proposer: '0x2222222222222222222222222222222222222222', description: 'add token', state: 'executed', for_votes: '30', against_votes: '1', created_at: '2026-01-01' },
];
const votes: Row[] = [
  { proposal_id: '1', voter: VOTER, support: 1, weight: '10', created_at: '2026-01-02' },
  { proposal_id: '2', voter: VOTER, support: 0, weight: '5', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('GovernanceService', () => {
  it('lists proposals and filters by state', async () => {
    const svc = createGovernanceService(makeCtx({ db: makeDb({ proposals }) }));
    expect((await svc.listProposals({ pagination: page })).total).toBe(2);
    const active = await svc.listProposals({ pagination: page, state: 'active' });
    expect(active.total).toBe(1);
    expect(active.rows[0]?.id).toBe('1');
  });

  it('resolves a proposal DB-first then via proposalOf', async () => {
    const dbSvc = createGovernanceService(makeCtx({ db: makeDb({ proposals }) }));
    expect(await dbSvc.getProposal('1')).toMatchObject({ id: '1', source: 'db' });

    const chain = makeChain({
      contracts: { ProposalRegistry: true },
      reads: { proposalOf: { proposer: PROPOSER, description: 'x', state: 4, forVotes: 9n, againstVotes: 0n, exists: true } },
    });
    const chainSvc = createGovernanceService(makeCtx({ db: makeDb({}), chain }));
    expect(await chainSvc.getProposal('9')).toMatchObject({ state: 'succeeded', for_votes: '9', source: 'chain' });
  });

  it('lists votes scoped to a proposal and voter', async () => {
    const svc = createGovernanceService(makeCtx({ db: makeDb({ votes }) }));
    const byProposal = await svc.listVotes({ pagination: page, proposalId: '1' });
    expect(byProposal.total).toBe(1);
    expect(byProposal.rows[0]?.weight).toBe('10');
    const byVoter = await svc.listVotes({ pagination: page, voter: VOTER });
    expect(byVoter.total).toBe(2);
  });

  it('returns null for an unknown proposal', async () => {
    const svc = createGovernanceService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getProposal('9')).toBeNull();
  });
});
