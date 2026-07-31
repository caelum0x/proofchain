/**
 * DppLifecycle service — DPP lifecycle events (DPPLifecycleRegistry).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/dpp-lifecycle.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A dpp lifecycle event row as stored in the `dpp_lifecycle_events` read model. */
export interface DppLifecycleRow {
  readonly event_id: string;
  readonly token_id: string | null;
  readonly stage: string | null;
  readonly actor: string | null;
  readonly note: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the DPP lifecycle event service bound to the request context. */
export const createDppLifecycleService = defineResourceService<DppLifecycleRow>({
  table: 'dpp_lifecycle_events',
  idColumn: 'event_id',
  searchColumns: ['note', 'stage', 'token_id'],
});
