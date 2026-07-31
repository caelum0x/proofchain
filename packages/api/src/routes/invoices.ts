/**
 * /invoices — tokenized receivables (M5: InvoiceNFT + ReceivableRegistry).
 *
 * Serves the `receivables` projection table: each funded+attested deal mints a
 * receivable NFT (`tokenId = uint256(batchId)`) with terms (face value, obligor,
 * holder, due, status). The mint/registration events are projected here by the
 * finance indexer handler; this router exposes list / detail / search over them.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  Bytes32Schema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const RECEIVABLE_STATUSES = [
  'registered',
  'listed',
  'funded',
  'claimed',
  'settled',
] as const;

const SearchQuery = z.object({
  holder: AddressSchema.optional(),
  obligor: AddressSchema.optional(),
  status: z.enum(RECEIVABLE_STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/invoices', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'receivables',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/invoices/search', async (request) => {
    const pagination = paginate(request.query);
    const { holder, obligor, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'invoice search query',
    );
    return listTable(ctx.db, {
      table: 'receivables',
      pagination,
      filters: { holder, obligor, status },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/invoices/:batchId', async (request) => {
    const { batchId } = request.params as { batchId: string };
    const id = parseOrThrow(Bytes32Schema, batchId, 'batchId');
    return getRowOr404(ctx.db, 'receivables', 'batch_id', id, 'Receivable');
  });
});
