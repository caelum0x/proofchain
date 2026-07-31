/**
 * /nft — tokenized titles (M8: BatchNFT tokenized bill-of-lading, WarehouseReceipt).
 *
 * These ERC721s carry no dedicated projection table, so this router serves the
 * `indexer_events` audit log (esg group, BatchNFT/WarehouseReceipt contracts):
 * mint/transfer/issue/redeem activity.
 *   - GET /nft                → recent NFT events (both collections)
 *   - GET /nft/warehouse      → WarehouseReceipt issue/redeem events
 *   - GET /nft/search         → filter by contract / owner / tokenId
 *   - GET /nft/:tokenId       → activity for one tokenId
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  NumericIdSchema,
  listEvents,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const NFT_CONTRACTS = ['BatchNFT', 'WarehouseReceipt'] as const;

const SearchQuery = z.object({
  contract: z.enum(NFT_CONTRACTS).optional(),
  owner: AddressSchema.optional(),
  tokenId: NumericIdSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/nft', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'esg',
      contract: 'BatchNFT',
      pagination,
    });
  });

  app.get('/nft/warehouse', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'esg',
      contract: 'WarehouseReceipt',
      pagination,
    });
  });

  app.get('/nft/search', async (request) => {
    const pagination = paginate(request.query);
    const { contract, owner, tokenId } = parseOrThrow(
      SearchQuery,
      request.query,
      'nft search query',
    );
    return listEvents(ctx.db, {
      group: 'esg',
      ...(contract !== undefined ? { contract } : {}),
      filters: {
        ...(owner !== undefined ? { 'args->>to': owner } : {}),
        ...(tokenId !== undefined ? { 'args->>tokenId': tokenId } : {}),
      },
      pagination,
    });
  });

  app.get('/nft/:tokenId', async (request) => {
    const { tokenId } = request.params as { tokenId: string };
    const id = parseOrThrow(NumericIdSchema, tokenId, 'tokenId');
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'esg',
      filters: { 'args->>tokenId': id },
      pagination,
    });
  });
});
