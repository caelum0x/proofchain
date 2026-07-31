/**
 * /referrals — referral attribution & payouts (M10: ReferralProgram).
 *
 * No dedicated projection table; served from the `indexer_events` audit log
 * (rewards group, ReferralProgram contract): referrals, conversions, payouts.
 *   - GET /referrals                    → recent referral events
 *   - GET /referrals/conversions        → recorded conversions only
 *   - GET /referrals/search             → filter by referrer / referee
 *   - GET /referrals/:referrer          → one referrer's activity
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  listEvents,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const SearchQuery = z.object({
  referrer: AddressSchema.optional(),
  referee: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/referrals', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'rewards',
      contract: 'ReferralProgram',
      pagination,
    });
  });

  app.get('/referrals/conversions', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'rewards',
      contract: 'ReferralProgram',
      eventName: 'ConversionRecorded',
      pagination,
    });
  });

  app.get('/referrals/search', async (request) => {
    const pagination = paginate(request.query);
    const { referrer, referee } = parseOrThrow(
      SearchQuery,
      request.query,
      'referral search query',
    );
    return listEvents(ctx.db, {
      group: 'rewards',
      contract: 'ReferralProgram',
      filters: {
        ...(referrer !== undefined ? { 'args->>referrer': referrer } : {}),
        ...(referee !== undefined ? { 'args->>referee': referee } : {}),
      },
      pagination,
    });
  });

  app.get('/referrals/:referrer', async (request) => {
    const { referrer } = request.params as { referrer: string };
    const address = parseOrThrow(AddressSchema, referrer, 'referrer address');
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'rewards',
      contract: 'ReferralProgram',
      filters: { 'args->>referrer': address },
      pagination,
    });
  });
});
