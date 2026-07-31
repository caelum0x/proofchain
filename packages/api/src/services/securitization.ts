/**
 * Securitization service — receivable securitization pools (ReceivableSecuritization).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/securitization.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A securitization pool row as stored in the `securitizations` read model. */
export interface SecuritizationRow {
  readonly pool_id: string;
  readonly originator: string | null;
  readonly spv: string | null;
  readonly total_value: string | null;
  readonly tranche_count: string | null;
  readonly name: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Securitization pool service bound to the request context. */
export const createSecuritizationService = defineResourceService<SecuritizationRow>({
  table: 'securitizations',
  idColumn: 'pool_id',
  searchColumns: ['name', 'originator'],
});
