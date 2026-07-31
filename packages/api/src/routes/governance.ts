/**
 * /governance — on-chain governance (M7: ProofChainGovernor, ProposalRegistry,
 * GovernanceToken).
 *
 * Serves the `proposals` projection and the append-only `votes` table.
 *   - GET /governance/proposals              → list proposals
 *   - GET /governance/proposals/search       → filter by state/proposer
 *   - GET /governance/proposals/:id          → one proposal
 *   - GET /governance/proposals/:id/votes    → votes cast on a proposal
 *   - GET /governance/votes                  → recent votes across proposals
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  IdSchema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const SearchQuery = z.object({
  state: z.string().trim().min(1).max(32).optional(),
  proposer: AddressSchema.optional(),
});

const VoteSearchQuery = z.object({
  voter: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/governance/proposals', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'proposals',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/governance/proposals/search', async (request) => {
    const pagination = paginate(request.query);
    const { state, proposer } = parseOrThrow(
      SearchQuery,
      request.query,
      'proposal search query',
    );
    return listTable(ctx.db, {
      table: 'proposals',
      pagination,
      filters: { state, proposer },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/governance/proposals/:id/votes', async (request) => {
    const { id } = request.params as { id: string };
    const proposalId = parseOrThrow(IdSchema, id, 'proposal id');
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'votes',
      pagination,
      filters: { proposal_id: proposalId },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/governance/proposals/:id', async (request) => {
    const { id } = request.params as { id: string };
    const proposalId = parseOrThrow(IdSchema, id, 'proposal id');
    return getRowOr404(ctx.db, 'proposals', 'id', proposalId, 'Proposal');
  });

  app.get('/governance/votes', async (request) => {
    const pagination = paginate(request.query);
    const { voter } = parseOrThrow(
      VoteSearchQuery,
      request.query,
      'vote query',
    );
    return listTable(ctx.db, {
      table: 'votes',
      pagination,
      filters: { voter },
      order: { column: 'created_at', ascending: false },
    });
  });
});
