/**
 * LettersOfCredit service — documentary Letters of Credit (LetterOfCredit).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/letters-of-credit.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A letter of credit row as stored in the `letters_of_credit` read model. */
export interface LettersOfCreditRow {
  readonly lc_id: string;
  readonly applicant: string | null;
  readonly beneficiary: string | null;
  readonly issuing_bank: string | null;
  readonly amount: string | null;
  readonly currency: string | null;
  readonly reference: string | null;
  readonly status: string | null;
  readonly expiry: string | null;
  readonly created_at: string | null;
}

/** Build the Letter of credit service bound to the request context. */
export const createLettersOfCreditService = defineResourceService<LettersOfCreditRow>({
  table: 'letters_of_credit',
  idColumn: 'lc_id',
  searchColumns: ['reference', 'applicant', 'beneficiary'],
});
