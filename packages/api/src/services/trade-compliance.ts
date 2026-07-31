/**
 * TradeCompliance service — trade compliance engine checks (TradeComplianceEngine).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/trade-compliance.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A trade compliance check row as stored in the `trade_compliance_checks` read model. */
export interface TradeComplianceRow {
  readonly check_id: string;
  readonly subject: string | null;
  readonly batch_id: string | null;
  readonly jurisdiction: string | null;
  readonly result: string | null;
  readonly status: string | null;
  readonly created_at: string | null;
}

/** Build the Trade compliance check service bound to the request context. */
export const createTradeComplianceService = defineResourceService<TradeComplianceRow>({
  table: 'trade_compliance_checks',
  idColumn: 'check_id',
  searchColumns: ['batch_id', 'jurisdiction', 'subject'],
});
