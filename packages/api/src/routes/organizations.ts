/**
 * /organizations — orgs that suppliers/buyers/carriers belong to (M3
 * OrganizationRegistry).
 *
 * List/search read the indexed `organizations` read model; detail is DB-first
 * with an on-chain `orgOf` fallback. A `?member=0x..` query on the detail route
 * answers membership via the on-chain `isMember` view.
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexAddress,
  hexBatchId,
  jsonSafe,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface OrgRow {
  id: string;
  name: string | null;
  org_type: string | null;
  admin: string | null;
}

interface OnChainOrg {
  orgId: string;
  name: string;
  orgType: number;
  metadataURI: string;
  admin: string;
  createdAt: bigint;
  exists: boolean;
}

const TABLE = 'organizations';
const CONTRACT = 'OrganizationRegistry';

const SearchQuery = z.object({ q: z.string().trim().min(1).optional() });
const IdParams = z.object({ id: hexBatchId });
const DetailQuery = z.object({ member: hexAddress.optional() });

const readChainOrg = async (
  ctx: AppContext,
  id: string,
): Promise<OrgRow | null> => {
  const contract = resolveContract(ctx, CONTRACT);
  if (contract === null) return null;
  const org = (await readView(ctx, contract, 'orgOf', [id])) as
    | OnChainOrg
    | undefined;
  if (org === undefined || org.exists !== true) return null;
  return {
    id: id.toLowerCase(),
    name: org.name,
    org_type: String(org.orgType),
    admin: org.admin.toLowerCase(),
  };
};

export default defineRoutes((app, ctx) => {
  app.get('/organizations', async (request) => {
    const pagination = parsePagination(request.query);
    const [rows, total] = await Promise.all([
      ctx.db.list<OrgRow>(TABLE, {
        ...pagination,
        order: { column: 'created_at', ascending: false },
      }),
      ctx.db.count(TABLE),
    ]);
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/organizations/search', async (request) => {
    const { q } = parseOr400(SearchQuery, request.query);
    const pagination = parsePagination(request.query);
    const rows = await ctx.db.list<OrgRow>(TABLE, {
      ...pagination,
      order: { column: 'created_at', ascending: false },
    });
    const needle = q?.toLowerCase();
    const matched =
      needle === undefined
        ? rows
        : rows.filter((r) => (r.name ?? '').toLowerCase().includes(needle));
    return okPage(matched, pageMeta(matched.length, pagination));
  });

  app.get('/organizations/:id', async (request) => {
    const { id } = parseOr400(IdParams, request.params);
    const { member } = parseOr400(DetailQuery, request.query);

    let org: OrgRow | null = await ctx.db.getBy<OrgRow>(TABLE, 'id', id);
    let source: 'db' | 'chain' = 'db';
    if (org === null) {
      org = await readChainOrg(ctx, id);
      source = 'chain';
    }
    if (org === null) {
      throw notFound(`Organization ${id} not found`);
    }

    let isMember: boolean | undefined;
    if (member !== undefined) {
      const contract = resolveContract(ctx, CONTRACT);
      isMember =
        contract === null
          ? undefined
          : ((await readView(ctx, contract, 'isMember', [id, member])) as boolean);
    }

    return ok({
      ...(jsonSafe(org) as OrgRow),
      source,
      ...(isMember !== undefined ? { isMember } : {}),
    });
  });
});
