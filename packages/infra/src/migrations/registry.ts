/**
 * Migration registry. Migration modules self-register at load time; the
 * generated `scripts/index.ts` barrel imports them all.
 */
import type { Migration } from "./types.js";

const registry = new Map<string, Migration>();

/** Register (or replace) a migration by its id. */
export function registerMigration(migration: Migration): void {
  registry.set(migration.id, migration);
}

/** All registered migrations, sorted by id (apply order). */
export function registeredMigrations(): readonly Migration[] {
  return [...registry.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}
