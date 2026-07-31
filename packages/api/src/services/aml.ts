/**
 * Aml service — AML risk records (AMLRegistry).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/aml.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A aml record row as stored in the `aml_records` read model. */
export interface AmlRow {
  readonly address: string;
  readonly risk_level: string | null;
  readonly status: string | null;
  readonly notes: string | null;
  readonly last_review: string | null;
  readonly created_at: string | null;
}

/** Build the AML record service bound to the request context. */
export const createAmlService = defineResourceService<AmlRow>({
  table: 'aml_records',
  idColumn: 'address',
  searchColumns: ['notes', 'address'],
});
