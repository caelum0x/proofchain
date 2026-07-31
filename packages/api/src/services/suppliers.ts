/**
 * Suppliers service (M3 SupplierRegistry) — the CANONICAL example of the
 * service-layer convention (see `base.ts`).
 *
 * It aggregates the indexed `suppliers` read model (Supabase via `ctx.db`) with
 * an on-chain `profileOf` fallback (via `ctx.chain` + `@proofchain/shared`), and
 * returns typed DTOs with a `source` discriminator. The `/suppliers` route is a
 * thin adapter over this service: it validates input, calls a method, and wraps
 * the result in the response envelope.
 */
import type { Pagination } from '../lib/pagination.js';
import {
  jsonSafe,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';

const TABLE = 'suppliers';
const CONTRACT = 'SupplierRegistry';

/** A supplier as stored in the indexed read model. */
export interface SupplierRow {
  readonly address: string;
  readonly name: string | null;
  readonly uri: string | null;
  readonly org_id: string | null;
}

/** Detail DTO: a supplier row plus where it was resolved from. */
export type SupplierDetail = SupplierRow & { readonly source: 'db' | 'chain' };

/** Shape returned by the on-chain `profileOf(address)` view. */
interface OnChainProfile {
  readonly account: string;
  readonly name: string;
  readonly uri: string;
  readonly registeredAt: bigint;
  readonly exists: boolean;
}

export interface SupplierListQuery {
  readonly pagination: Pagination;
  readonly orgId?: string;
}

export interface SupplierSearchQuery extends SupplierListQuery {
  readonly q?: string;
}

export interface SuppliersService {
  /** Page the indexed suppliers, optionally scoped to an organization. */
  list(query: SupplierListQuery): Promise<ListResult<SupplierRow>>;
  /** Page + in-memory name-substring filter over the indexed suppliers. */
  search(query: SupplierSearchQuery): Promise<ListResult<SupplierRow>>;
  /** Resolve one supplier (DB-first, on-chain fallback), or null if unknown. */
  getByAddress(address: string): Promise<SupplierDetail | null>;
}

/** Build a {@link SuppliersService} bound to the request context. */
export const createSuppliersService = defineService<SuppliersService>((ctx) => {
  const readChainProfile = async (
    address: string,
  ): Promise<SupplierRow | null> => {
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

  return {
    async list({ pagination, orgId }): Promise<ListResult<SupplierRow>> {
      return pageRows<SupplierRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(orgId !== undefined ? { filters: { org_id: orgId } } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async search({ pagination, q, orgId }): Promise<ListResult<SupplierRow>> {
      const rows = await ctx.db.list<SupplierRow>(TABLE, {
        ...pagination,
        order: { column: 'created_at', ascending: false },
        ...(orgId !== undefined ? { filters: { org_id: orgId } } : {}),
      });
      const needle = q?.toLowerCase();
      const matched =
        needle === undefined
          ? rows
          : rows.filter((r) => (r.name ?? '').toLowerCase().includes(needle));
      return { rows: matched, total: matched.length };
    },

    async getByAddress(address): Promise<SupplierDetail | null> {
      const row = await ctx.db.getBy<SupplierRow>(TABLE, 'address', address);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainProfile(address);
      if (onChain === null) return null;
      return { ...(jsonSafe(onChain) as SupplierRow), source: 'chain' };
    },
  };
});
