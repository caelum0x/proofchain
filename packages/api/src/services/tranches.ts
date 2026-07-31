/**
 * Tranches service — securitization tranche tokens (TrancheToken).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/tranches.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A tranche row as stored in the `tranches` read model. */
export interface TranchesRow {
  readonly tranche_id: string;
  readonly pool_id: string | null;
  readonly token: string | null;
  readonly seniority: string | null;
  readonly coupon_rate: string | null;
  readonly principal: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Tranche service bound to the request context. */
export const createTranchesService = defineResourceService<TranchesRow>({
  table: 'tranches',
  idColumn: 'tranche_id',
  searchColumns: ['token', 'pool_id', 'seniority'],
});
