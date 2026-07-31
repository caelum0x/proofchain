/**
 * /rewards — loyalty & staking rewards (M10: LoyaltyPoints, RewardsDistributor,
 * StakingRewards). Serves the `rewards` projection (per account/program amount
 * accrued vs claimed). List / detail / search by account or program.
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
  account: AddressSchema.optional(),
  program: z.string().trim().min(1).max(64).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/rewards', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'rewards',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/rewards/search', async (request) => {
    const pagination = paginate(request.query);
    const { account, program } = parseOrThrow(
      SearchQuery,
      request.query,
      'rewards search query',
    );
    return listTable(ctx.db, {
      table: 'rewards',
      pagination,
      filters: { account, program },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/rewards/:id', async (request) => {
    const { id } = request.params as { id: string };
    const rewardId = parseOrThrow(IdSchema, id, 'reward id');
    return getRowOr404(ctx.db, 'rewards', 'id', rewardId, 'Reward');
  });
});
