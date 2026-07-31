/**
 * Migration 0001 — the canonical example.
 *
 * Adds supplementary indexes to core read-model tables. Statements are
 * idempotent (`create index if not exists`) so applying twice is safe.
 *
 * Fill convention (copy this file): create
 * `src/migrations/scripts/<NNNN>_<slug>.ts`, register a `Migration` with a
 * sortable id and idempotent statements, then run `pnpm run barrels`.
 */
import { registerMigration } from "../registry.js";

registerMigration({
  id: "0001_add_indexes",
  name: "Add supplementary read-model indexes",
  statements: [
    "create index if not exists deals_token_idx on deals (token)",
    "create index if not exists verdicts_model_idx on verdicts (model)",
  ],
});
