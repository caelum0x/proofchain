/**
 * Phytosanitary service — Phytosanitary Certificates (PhytosanitaryCertificate).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/phytosanitary.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A phytosanitary certificate row as stored in the `phytosanitary_certificates` read model. */
export interface PhytosanitaryRow {
  readonly certificate_id: string;
  readonly exporter: string | null;
  readonly origin_country: string | null;
  readonly destination_country: string | null;
  readonly commodity: string | null;
  readonly treatment: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Phytosanitary certificate service bound to the request context. */
export const createPhytosanitaryService = defineResourceService<PhytosanitaryRow>({
  table: 'phytosanitary_certificates',
  idColumn: 'certificate_id',
  searchColumns: ['commodity', 'treatment', 'origin_country'],
});
