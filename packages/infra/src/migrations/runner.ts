/**
 * Migration runner — applies pending migrations at most once, tracked in the
 * `schema_migrations` ledger.
 *
 * No-op-safe: without an `execute` function or a ledger client it performs a
 * DRY RUN — it never throws and never applies DDL, instead reporting which
 * migrations would run. This mirrors the rest of the package: a missing DB
 * degrades gracefully instead of crashing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../errors.js";
import { sha256Json } from "../hash.js";
import { registeredMigrations } from "./registry.js";
import type {
  Migration,
  MigrationContext,
  MigrationRunResult,
  MigrationRunner,
} from "./types.js";

const LEDGER = "schema_migrations";

/** Build a runner bound to a context (client + optional DDL executor). */
export function createMigrationRunner(context: MigrationContext = {}): MigrationRunner {
  return {
    async run(
      migrations: readonly Migration[] = registeredMigrations(),
    ): Promise<Result<MigrationRunResult>> {
      return runMigrations(migrations, context);
    },
  };
}

/** Apply pending migrations in id order. Returns applied/skipped/pending ids. */
export async function runMigrations(
  migrations: readonly Migration[] = registeredMigrations(),
  context: MigrationContext = {},
): Promise<Result<MigrationRunResult>> {
  const ordered = [...migrations].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const duplicate = firstDuplicateId(ordered);
  if (duplicate !== null) {
    return err(InfraErrorCode.VALIDATION, `Duplicate migration id: ${duplicate}`);
  }

  const client = context.client ?? null;
  const canApply = client !== null && context.execute !== undefined;

  const appliedLedger = await readLedger(client);
  if (!appliedLedger.success) return appliedLedger;
  const alreadyApplied = new Set(appliedLedger.data);

  const applied: string[] = [];
  const skipped: string[] = [];
  const pending: string[] = [];

  for (const migration of ordered) {
    if (alreadyApplied.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }
    if (!canApply) {
      pending.push(migration.id);
      continue;
    }
    const result = await applyOne(migration, client, context.execute!);
    if (!result.success) return result;
    applied.push(migration.id);
  }

  return ok({ applied, skipped, pending });
}

// -----------------------------------------------------------------------------
// internals
// -----------------------------------------------------------------------------

async function readLedger(
  client: SupabaseClient | null,
): Promise<Result<readonly string[]>> {
  if (client === null) return ok<readonly string[]>([]);
  try {
    const { data, error } = await client.from(LEDGER).select("id");
    if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "readLedger" });
    const ids = ((data ?? []) as Array<{ id?: unknown }>)
      .map((r) => r.id)
      .filter((id): id is string => typeof id === "string");
    return ok<readonly string[]>(ids);
  } catch (error) {
    return err(InfraErrorCode.SUPABASE, "readLedger failed", {
      cause: toEnvelope(error),
    });
  }
}

async function applyOne(
  migration: Migration,
  client: SupabaseClient,
  execute: (sql: string) => Promise<void>,
): Promise<Result<true>> {
  try {
    for (const statement of migration.statements) {
      await execute(statement);
    }
  } catch (error) {
    return err(InfraErrorCode.UNEXPECTED, `Migration ${migration.id} failed`, {
      cause: toEnvelope(error),
    });
  }
  try {
    const { error } = await client.from(LEDGER).insert({
      id: migration.id,
      name: migration.name,
      checksum: sha256Json(migration.statements),
    });
    if (error) {
      return err(InfraErrorCode.SUPABASE, error.message, {
        op: "recordLedger",
        id: migration.id,
      });
    }
  } catch (error) {
    return err(InfraErrorCode.SUPABASE, `Recording ${migration.id} failed`, {
      cause: toEnvelope(error),
    });
  }
  return ok(true);
}

function firstDuplicateId(migrations: readonly Migration[]): string | null {
  const seen = new Set<string>();
  for (const m of migrations) {
    if (seen.has(m.id)) return m.id;
    seen.add(m.id);
  }
  return null;
}
