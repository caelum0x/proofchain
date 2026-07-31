/**
 * Customs service — customs declarations (CustomsDeclaration).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/customs.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A customs declaration row as stored in the `customs_declarations` read model. */
export interface CustomsRow {
  readonly declaration_id: string;
  readonly declarant: string | null;
  readonly port: string | null;
  readonly direction: string | null;
  readonly reference: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Customs declaration service bound to the request context. */
export const createCustomsService = defineResourceService<CustomsRow>({
  table: 'customs_declarations',
  idColumn: 'declaration_id',
  searchColumns: ['reference', 'port'],
});
