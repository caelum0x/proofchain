/**
 * Migration types.
 *
 * A migration is an ordered set of idempotent SQL statements identified by a
 * sortable `id` (e.g. "0001_add_indexes"). The runner records applied ids in the
 * `schema_migrations` ledger so each migration runs at most once. DDL execution
 * is delegated to an injected `execute` function (wrap a pg client or a Supabase
 * `exec_sql` RPC), keeping this package driver-agnostic.
 *
 * Fill convention: add one file per migration under `src/migrations/scripts/`,
 * call `registerMigration({...})`, then run `pnpm run barrels`.
 */
import type { Result } from "../errors.js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A single, ordered, idempotent migration. */
export interface Migration {
  /** Sortable unique id, e.g. "0001_add_indexes". Determines apply order. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Idempotent SQL statements, executed in array order. */
  readonly statements: readonly string[];
}

/** Everything the runner needs; every field optional for no-op safety. */
export interface MigrationContext {
  /** Client used to read/write the `schema_migrations` ledger. */
  readonly client?: SupabaseClient | null;
  /** Applies one DDL statement. Absent → dry-run (nothing is applied). */
  readonly execute?: (sql: string) => Promise<void>;
}

/** Outcome of a migration run. */
export interface MigrationRunResult {
  /** Ids applied during this run. */
  readonly applied: readonly string[];
  /** Ids already present in the ledger (skipped). */
  readonly skipped: readonly string[];
  /** Ids that could not be applied (no executor/ledger) — reported, not run. */
  readonly pending: readonly string[];
}

/** A migration runner. */
export interface MigrationRunner {
  run(migrations?: readonly Migration[]): Promise<Result<MigrationRunResult>>;
}
