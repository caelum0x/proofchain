/**
 * Migration 0002 — supplementary trade-finance read-model indexes.
 *
 * Adds date-oriented indexes that back "maturing soon" / "expiring" dashboards
 * over the trade-finance tables defined in schema/10–19. These complement (never
 * replace) the base indexes shipped in the schema modules. All statements are
 * idempotent (`create index if not exists`) so re-applying is safe.
 */
import { registerMigration } from "../registry.js";

registerMigration({
  id: "0002_trade_finance_indexes",
  name: "Supplementary trade-finance date indexes",
  statements: [
    "create index if not exists letters_of_credit_expiry_idx on letters_of_credit (expiry_date)",
    "create index if not exists factoring_agreements_maturity_idx on factoring_agreements (maturity_date)",
    "create index if not exists po_financings_due_idx on po_financings (due_date)",
    "create index if not exists credit_lines_expiry_idx on credit_lines (expiry_date)",
    "create index if not exists guarantees_expiry_idx on guarantees (expiry_date)",
    "create index if not exists bills_of_exchange_maturity_idx on bills_of_exchange (maturity_date)",
    "create index if not exists dynamic_discounts_expiry_idx on dynamic_discounts (offer_expiry)",
  ],
});
