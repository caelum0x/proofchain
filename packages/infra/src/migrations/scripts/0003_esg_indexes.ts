/**
 * Migration 0003 — supplementary energy/ESG read-model indexes.
 *
 * Adds vintage-year indexes over the environmental-credit tables defined in
 * schema/54–59, backing "credits by vintage" registry views. Idempotent
 * (`create index if not exists`) and additive to the schema-module indexes.
 */
import { registerMigration } from "../registry.js";

registerMigration({
  id: "0003_esg_indexes",
  name: "Supplementary energy/ESG vintage indexes",
  statements: [
    "create index if not exists renewable_certificates_vintage_idx on renewable_certificates (vintage_year)",
    "create index if not exists water_credits_vintage_idx on water_credits (vintage_year)",
    "create index if not exists biodiversity_credits_vintage_idx on biodiversity_credits (vintage_year)",
    "create index if not exists emission_allowances_vintage_idx on emission_allowances (vintage_year)",
  ],
});
