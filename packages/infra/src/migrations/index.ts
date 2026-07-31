/**
 * Migrations subsystem entrypoint.
 *
 * Importing this module registers every migration under `scripts/` (via the
 * generated barrel) and exposes the runner + registry. The runner is no-op-safe:
 * with no executor it performs a dry run.
 */
export type {
  Migration,
  MigrationContext,
  MigrationRunResult,
  MigrationRunner,
} from "./types.js";
export {
  createMigrationRunner,
  runMigrations,
} from "./runner.js";
export {
  registerMigration,
  registeredMigrations,
} from "./registry.js";
// Side-effect import: evaluates every migration module so they self-register.
import "./scripts/index.js";
