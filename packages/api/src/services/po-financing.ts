/**
 * PoFinancing service — purchase-order financing (PurchaseOrderFinancing).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/po-financing.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A po financing row as stored in the `po_financings` read model. */
export interface PoFinancingRow {
  readonly po_id: string;
  readonly buyer: string | null;
  readonly supplier: string | null;
  readonly financier: string | null;
  readonly amount: string | null;
  readonly po_ref: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the PO financing service bound to the request context. */
export const createPoFinancingService = defineResourceService<PoFinancingRow>({
  table: 'po_financings',
  idColumn: 'po_id',
  searchColumns: ['po_ref', 'buyer', 'supplier'],
});
