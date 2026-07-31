/**
 * Migration 0004 — supplementary compliance read-model indexes.
 *
 * Adds filter/recency indexes over the compliance tables defined in schema/21–29
 * that are not part of the base module indexes (customs direction, recall
 * recency, duty type). Idempotent (`create index if not exists`) and additive.
 */
import { registerMigration } from "../registry.js";

registerMigration({
  id: "0004_compliance_indexes",
  name: "Supplementary compliance filter indexes",
  statements: [
    "create index if not exists customs_declarations_direction_idx on customs_declarations (direction)",
    "create index if not exists duty_assessments_type_idx on duty_assessments (duty_type)",
    "create index if not exists product_recalls_created_idx on product_recalls (created_at)",
    "create index if not exists export_licenses_expiry_idx on export_licenses (expiry_date)",
    "create index if not exists sanctions_screenings_score_idx on sanctions_screenings (match_score)",
  ],
});
