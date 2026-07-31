/**
 * Guarantees service — bank/performance Guarantees (GuaranteeRegistry).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/guarantees.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A guarantee row as stored in the `guarantees` read model. */
export interface GuaranteesRow {
  readonly guarantee_id: string;
  readonly guarantor: string | null;
  readonly beneficiary: string | null;
  readonly obligor: string | null;
  readonly amount: string | null;
  readonly kind: string | null;
  readonly reference: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Guarantee service bound to the request context. */
export const createGuaranteesService = defineResourceService<GuaranteesRow>({
  table: 'guarantees',
  idColumn: 'guarantee_id',
  searchColumns: ['reference', 'guarantor', 'beneficiary'],
});
