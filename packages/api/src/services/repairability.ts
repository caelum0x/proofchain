/**
 * Repairability service — DPP repairability indices (RepairabilityIndex).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/repairability.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A repairability score row as stored in the `repairability_scores` read model. */
export interface RepairabilityRow {
  readonly token_id: string;
  readonly score: string | null;
  readonly grade: string | null;
  readonly manual_uri: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Repairability score service bound to the request context. */
export const createRepairabilityService = defineResourceService<RepairabilityRow>({
  table: 'repairability_scores',
  idColumn: 'token_id',
  searchColumns: ['manual_uri', 'grade'],
});
