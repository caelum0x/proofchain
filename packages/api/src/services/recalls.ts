/**
 * Recalls service — product recall notices (ProductRecallRegistry).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/recalls.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A product recall row as stored in the `product_recalls` read model. */
export interface RecallsRow {
  readonly recall_id: string;
  readonly manufacturer: string | null;
  readonly product: string | null;
  readonly batch_id: string | null;
  readonly severity: string | null;
  readonly reason: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Product recall service bound to the request context. */
export const createRecallsService = defineResourceService<RecallsRow>({
  table: 'product_recalls',
  idColumn: 'recall_id',
  searchColumns: ['product', 'reason', 'batch_id'],
});
