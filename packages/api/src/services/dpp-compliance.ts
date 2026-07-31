/**
 * DppCompliance service — DPP compliance assessments (DPPComplianceOracle).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/dpp-compliance.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A dpp compliance record row as stored in the `dpp_compliance` read model. */
export interface DppComplianceRow {
  readonly token_id: string;
  readonly regulation: string | null;
  readonly verifier: string | null;
  readonly assessed_at: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the DPP compliance record service bound to the request context. */
export const createDppComplianceService = defineResourceService<DppComplianceRow>({
  table: 'dpp_compliance',
  idColumn: 'token_id',
  searchColumns: ['regulation'],
});
