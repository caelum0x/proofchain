/**
 * CertificatesOrigin service — Certificates of Origin (CertificateOfOrigin).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/certificates-origin.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A certificate of origin row as stored in the `certificates_origin` read model. */
export interface CertificatesOriginRow {
  readonly certificate_id: string;
  readonly exporter: string | null;
  readonly importer: string | null;
  readonly origin_country: string | null;
  readonly product: string | null;
  readonly hs_code: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Certificate of origin service bound to the request context. */
export const createCertificatesOriginService = defineResourceService<CertificatesOriginRow>({
  table: 'certificates_origin',
  idColumn: 'certificate_id',
  searchColumns: ['product', 'origin_country', 'hs_code'],
});
