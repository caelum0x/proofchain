/**
 * Duties service — duty & tariff calculations (DutyAndTariffCalculator).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/duties.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A duty calculation row as stored in the `duty_calculations` read model. */
export interface DutiesRow {
  readonly calculation_id: string;
  readonly declarant: string | null;
  readonly hs_code: string | null;
  readonly origin_country: string | null;
  readonly customs_value: string | null;
  readonly duty_amount: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Duty calculation service bound to the request context. */
export const createDutiesService = defineResourceService<DutiesRow>({
  table: 'duty_calculations',
  idColumn: 'calculation_id',
  searchColumns: ['hs_code', 'origin_country'],
});
