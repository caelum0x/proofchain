/**
 * BillsOfExchange service — negotiable Bills of Exchange (BillOfExchange).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/bills-of-exchange.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A bill of exchange row as stored in the `bills_of_exchange` read model. */
export interface BillsOfExchangeRow {
  readonly bill_id: string;
  readonly drawer: string | null;
  readonly drawee: string | null;
  readonly payee: string | null;
  readonly amount: string | null;
  readonly currency: string | null;
  readonly maturity: string | null;
  readonly reference: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Bill of exchange service bound to the request context. */
export const createBillsOfExchangeService = defineResourceService<BillsOfExchangeRow>({
  table: 'bills_of_exchange',
  idColumn: 'bill_id',
  searchColumns: ['reference', 'drawer', 'payee'],
});
