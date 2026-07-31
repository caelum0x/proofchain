/**
 * Filter helper shared by the domain services.
 *
 * Services build equality filters from optional query fields; a filter whose
 * value is `undefined` must be dropped before it reaches the db layer (the
 * generic query builder treats every entry as an `.eq(column, value)`, so an
 * `undefined` would filter on `col = undefined` and return nothing). This mirrors
 * the router-side `compactFilters` but lives under `src/services/` so services do
 * not depend on the router read helpers.
 */
import type { FilterValue } from '../lib/db.js';

/** Drop `undefined` entries so only explicit filters reach the query builder. */
export const compactFilters = (
  filters: Readonly<Record<string, FilterValue | undefined>>,
): Record<string, FilterValue> => {
  const out: Record<string, FilterValue> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};
