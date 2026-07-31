/**
 * /payments — multi-stablecoin payment routing (M2: PaymentRouter,
 * StablecoinRegistry, FeeManager).
 *
 * These contracts have no dedicated projection table, so this router serves the
 * append-only `indexer_events` audit log filtered to the settlement group and
 * the relevant contracts/events (`Routed`, `TokenAdded`, `FeeCollected`).
 *   - GET /payments          → recent routed payments
 *   - GET /payments/tokens   → accepted stablecoins (StablecoinRegistry)
 *   - GET /payments/fees     → collected protocol fees (FeeManager)
 *   - GET /payments/search   → filter routed payments by payer/token
 *   - GET /payments/:txHash  → all payment events in one transaction
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  listEvents,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const TxHashSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 32-byte transaction hash')
  .transform((s) => s.toLowerCase());

const SearchQuery = z.object({
  payer: AddressSchema.optional(),
  token: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/payments', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'settlement',
      contract: 'PaymentRouter',
      eventName: 'Routed',
      pagination,
    });
  });

  app.get('/payments/tokens', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'settlement',
      contract: 'StablecoinRegistry',
      eventName: 'TokenAdded',
      pagination,
    });
  });

  app.get('/payments/fees', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'settlement',
      contract: 'FeeManager',
      eventName: 'FeeCollected',
      pagination,
    });
  });

  app.get('/payments/search', async (request) => {
    const pagination = paginate(request.query);
    const { payer, token } = parseOrThrow(
      SearchQuery,
      request.query,
      'payment search query',
    );
    return listEvents(ctx.db, {
      group: 'settlement',
      contract: 'PaymentRouter',
      eventName: 'Routed',
      filters: {
        ...(payer !== undefined ? { 'args->>payer': payer } : {}),
        ...(token !== undefined ? { 'args->>token': token } : {}),
      },
      pagination,
    });
  });

  app.get('/payments/:txHash', async (request) => {
    const { txHash } = request.params as { txHash: string };
    const hash = parseOrThrow(TxHashSchema, txHash, 'transaction hash');
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'settlement',
      filters: { tx_hash: hash },
      pagination,
    });
  });
});
