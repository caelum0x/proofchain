/**
 * /carriers — logistics carrier profiles (M3 CarrierRegistry).
 *
 * Carriers can push provenance checkpoints, so their identity is surfaced the
 * same way as suppliers/buyers: indexed read model for list/search, on-chain
 * `profileOf` fallback for detail.
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexAddress,
  jsonSafe,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface CarrierRow {
  address: string;
  name: string | null;
  uri: string | null;
  org_id: string | null;
}

interface OnChainProfile {
  account: string;
  name: string;
  uri: string;
  registeredAt: bigint;
  exists: boolean;
}

const TABLE = 'carriers';
const CONTRACT = 'CarrierRegistry';

const ListQuery = z.object({ org_id: z.string().min(1).optional() });
const SearchQuery = z.object({
  q: z.string().trim().min(1).optional(),
  org_id: z.string().min(1).optional(),
});
const AddressParams = z.object({ address: hexAddress });

const readChainProfile = async (
  ctx: AppContext,
  address: string,
): Promise<CarrierRow | null> => {
  const contract = resolveContract(ctx, CONTRACT);
  if (contract === null) return null;
  const profile = (await readView(ctx, contract, 'profileOf', [address])) as
    | OnChainProfile
    | undefined;
  if (profile === undefined || profile.exists !== true) return null;
  return {
    address: address.toLowerCase(),
    name: profile.name,
    uri: profile.uri,
    org_id: null,
  };
};

export default defineRoutes((app, ctx) => {
  app.get('/carriers', async (request) => {
    const { org_id } = parseOr400(ListQuery, request.query);
    const pagination = parsePagination(request.query);
    const filters = org_id !== undefined ? { org_id } : undefined;
    const [rows, total] = await Promise.all([
      ctx.db.list<CarrierRow>(TABLE, {
        ...pagination,
        order: { column: 'created_at', ascending: false },
        filters,
      }),
      ctx.db.count(TABLE, filters),
    ]);
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/carriers/search', async (request) => {
    const { q, org_id } = parseOr400(SearchQuery, request.query);
    const pagination = parsePagination(request.query);
    const filters = org_id !== undefined ? { org_id } : undefined;
    const rows = await ctx.db.list<CarrierRow>(TABLE, {
      ...pagination,
      order: { column: 'created_at', ascending: false },
      filters,
    });
    const needle = q?.toLowerCase();
    const matched =
      needle === undefined
        ? rows
        : rows.filter((r) => (r.name ?? '').toLowerCase().includes(needle));
    return okPage(matched, pageMeta(matched.length, pagination));
  });

  app.get('/carriers/:address', async (request) => {
    const { address } = parseOr400(AddressParams, request.params);
    const row = await ctx.db.getBy<CarrierRow>(TABLE, 'address', address);
    if (row !== null) return ok({ ...row, source: 'db' as const });

    const onChain = await readChainProfile(ctx, address);
    if (onChain === null) {
      throw notFound(`Carrier ${address} not found`);
    }
    return ok({ ...(jsonSafe(onChain) as CarrierRow), source: 'chain' as const });
  });
});
