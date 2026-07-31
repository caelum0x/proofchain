/**
 * ExportLicenses service — export license grants (ExportLicenseRegistry).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/export-licenses.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A export license row as stored in the `export_licenses` read model. */
export interface ExportLicensesRow {
  readonly license_id: string;
  readonly exporter: string | null;
  readonly authority: string | null;
  readonly destination_country: string | null;
  readonly goods: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Export license service bound to the request context. */
export const createExportLicensesService = defineResourceService<ExportLicensesRow>({
  table: 'export_licenses',
  idColumn: 'license_id',
  searchColumns: ['goods', 'destination_country'],
});
