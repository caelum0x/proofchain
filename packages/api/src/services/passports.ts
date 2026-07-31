/**
 * Passports service — EU Digital Product Passports (DigitalProductPassport).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/passports.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A passport row as stored in the `passports` read model. */
export interface PassportsRow {
  readonly token_id: string;
  readonly owner: string | null;
  readonly manufacturer: string | null;
  readonly product: string | null;
  readonly gtin: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Passport service bound to the request context. */
export const createPassportsService = defineResourceService<PassportsRow>({
  table: 'passports',
  idColumn: 'token_id',
  searchColumns: ['product', 'gtin'],
});
