/**
 * Factoring service — receivable Factoring agreements (FactoringAgreement).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/factoring.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A factoring agreement row as stored in the `factoring_agreements` read model. */
export interface FactoringRow {
  readonly agreement_id: string;
  readonly seller: string | null;
  readonly factor: string | null;
  readonly debtor: string | null;
  readonly face_value: string | null;
  readonly advance_rate: string | null;
  readonly invoice_ref: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Factoring agreement service bound to the request context. */
export const createFactoringService = defineResourceService<FactoringRow>({
  table: 'factoring_agreements',
  idColumn: 'agreement_id',
  searchColumns: ['invoice_ref', 'seller', 'factor'],
});
