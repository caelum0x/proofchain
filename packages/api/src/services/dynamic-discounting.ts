/**
 * DynamicDiscounting service — early-payment Dynamic Discounting offers (DynamicDiscounting).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/dynamic-discounting.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A dynamic discount offer row as stored in the `dynamic_discounts` read model. */
export interface DynamicDiscountingRow {
  readonly offer_id: string;
  readonly buyer: string | null;
  readonly supplier: string | null;
  readonly invoice_id: string | null;
  readonly discount_rate: string | null;
  readonly amount: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Dynamic discount offer service bound to the request context. */
export const createDynamicDiscountingService = defineResourceService<DynamicDiscountingRow>({
  table: 'dynamic_discounts',
  idColumn: 'offer_id',
  searchColumns: ['invoice_id', 'buyer', 'supplier'],
});
