/**
 * Sanctions service — sanctions screening results (SanctionsScreening).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/sanctions.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A sanctions screening row as stored in the `sanctions_screenings` read model. */
export interface SanctionsRow {
  readonly address: string;
  readonly list_name: string | null;
  readonly risk_score: string | null;
  readonly status: string | null;
  readonly screened_at: string | null;
  readonly created_at: string | null;
}

/** Build the Sanctions screening service bound to the request context. */
export const createSanctionsService = defineResourceService<SanctionsRow>({
  table: 'sanctions_screenings',
  idColumn: 'address',
  searchColumns: ['address', 'list_name'],
});
