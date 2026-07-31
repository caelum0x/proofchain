/**
 * /suppliers — supplier identity profiles (M3 SupplierRegistry).
 *
 * CANONICAL example of how a route calls a service: this file owns only HTTP
 * concerns — validate params/query with zod, invoke `SuppliersService`, and wrap
 * the typed result in the `{ success, data, error }` envelope. All chain+db
 * aggregation lives in `../services/suppliers.js`.
 */
import { z } from 'zod';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import { hexAddress, parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import { createSuppliersService } from '../services/suppliers.js';

const ListQuery = z.object({ org_id: z.string().min(1).optional() });
const SearchQuery = z.object({
  q: z.string().trim().min(1).optional(),
  org_id: z.string().min(1).optional(),
});
const AddressParams = z.object({ address: hexAddress });

export default defineRoutes((app, ctx) => {
  const suppliers = createSuppliersService(ctx);

  app.get('/suppliers', async (request) => {
    const { org_id } = parseOr400(ListQuery, request.query);
    const pagination = parsePagination(request.query);
    const { rows, total } = await suppliers.list({
      pagination,
      ...(org_id !== undefined ? { orgId: org_id } : {}),
    });
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/suppliers/search', async (request) => {
    const { q, org_id } = parseOr400(SearchQuery, request.query);
    const pagination = parsePagination(request.query);
    const { rows, total } = await suppliers.search({
      pagination,
      ...(q !== undefined ? { q } : {}),
      ...(org_id !== undefined ? { orgId: org_id } : {}),
    });
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/suppliers/:address', async (request) => {
    const { address } = parseOr400(AddressParams, request.params);
    const detail = await suppliers.getByAddress(address);
    if (detail === null) {
      throw notFound(`Supplier ${address} not found`);
    }
    return ok(detail);
  });
});
