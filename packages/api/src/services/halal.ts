/**
 * Halal service — Halal Certifications (HalalCertification).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/halal.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A halal certification row as stored in the `halal_certifications` read model. */
export interface HalalRow {
  readonly certificate_id: string;
  readonly producer: string | null;
  readonly certifier: string | null;
  readonly product: string | null;
  readonly scheme: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Halal certification service bound to the request context. */
export const createHalalService = defineResourceService<HalalRow>({
  table: 'halal_certifications',
  idColumn: 'certificate_id',
  searchColumns: ['product', 'scheme'],
});
