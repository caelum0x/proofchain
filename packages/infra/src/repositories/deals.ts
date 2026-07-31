/**
 * Deals repository — the canonical `BaseRepository` example over the existing
 * `deals` read-model table.
 *
 * Fill convention (copy this file):
 *   1. `import { BaseRepository, type RepositoryConfig } from "./base.js";`
 *   2. Build a `RepositoryConfig<Entity, Insert>` with `toRow` / `fromRow`
 *      mappers and the zod entity (+ optional insert) schema.
 *   3. Extend `BaseRepository` to add table-specific query methods.
 *   4. Export a `create<Table>Repository(client)` factory.
 *   5. Run `pnpm run barrels` to regenerate `index.ts` — never edit it by hand.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Deal,
  DealInput,
  type Deal as DealT,
  type DealInput as DealInputT,
} from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

const config: RepositoryConfig<DealT, DealInputT> = {
  table: "deals",
  primaryKey: "batch_id",
  entitySchema: Deal,
  insertSchema: DealInput,
  toRow: (d) => ({
    batch_id: d.batchId,
    buyer: d.buyer,
    supplier: d.supplier,
    token: d.token,
    amount: d.amount,
    state: d.state,
    tx_hash: d.txHash ?? null,
  }),
  fromRow: (row) => ({
    batchId: row.batch_id,
    buyer: row.buyer,
    supplier: row.supplier,
    token: row.token,
    // Numeric columns come back as string from PostgREST — keep as string.
    amount:
      row.amount === undefined || row.amount === null ? undefined : String(row.amount),
    state: row.state,
    txHash: row.tx_hash ?? null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `deals` table. */
export class DealsRepository extends BaseRepository<DealT, DealInputT> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All deals where the given address is the buyer, newest first. */
  findByBuyer(buyer: string): Promise<Result<readonly DealT[]>> {
    return this.find({
      filters: [{ column: "buyer", op: "eq", value: buyer }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All deals where the given address is the supplier, newest first. */
  findBySupplier(supplier: string): Promise<Result<readonly DealT[]>> {
    return this.find({
      filters: [{ column: "supplier", op: "eq", value: supplier }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All deals currently in the given lifecycle state. */
  findByState(state: DealT["state"]): Promise<Result<readonly DealT[]>> {
    return this.find({ filters: [{ column: "state", op: "eq", value: state }] });
  }
}

/** Factory: build a `DealsRepository` over the (possibly null) client. */
export function createDealsRepository(
  client: SupabaseClient | null,
): DealsRepository {
  return new DealsRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
