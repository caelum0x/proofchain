/**
 * Recycling service — DPP recycling records (RecyclingRegistry).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/recycling.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A recycling record row as stored in the `recycling_records` read model. */
export interface RecyclingRow {
  readonly record_id: string;
  readonly token_id: string | null;
  readonly recycler: string | null;
  readonly method: string | null;
  readonly recovered_pct: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Recycling record service bound to the request context. */
export const createRecyclingService = defineResourceService<RecyclingRow>({
  table: 'recycling_records',
  idColumn: 'record_id',
  searchColumns: ['method', 'token_id'],
});
