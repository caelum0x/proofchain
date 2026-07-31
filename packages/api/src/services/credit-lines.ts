/**
 * CreditLines service — revolving Credit Lines (CreditLineManager).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/credit-lines.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A credit line row as stored in the `credit_lines` read model. */
export interface CreditLinesRow {
  readonly line_id: string;
  readonly borrower: string | null;
  readonly lender: string | null;
  readonly limit_amount: string | null;
  readonly drawn_amount: string | null;
  readonly currency: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Credit line service bound to the request context. */
export const createCreditLinesService = defineResourceService<CreditLinesRow>({
  table: 'credit_lines',
  idColumn: 'line_id',
  searchColumns: ['borrower', 'lender', 'currency'],
});
