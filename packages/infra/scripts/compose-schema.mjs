#!/usr/bin/env node
/**
 * Schema composer — concatenates the per-domain SQL modules in `schema/` into
 * the single root `schema.sql` deploy artifact (referenced by package.json
 * `exports["./schema.sql"]` and `docs/DEPLOY.md`).
 *
 * Ordering is by filename, so modules are prefixed with a numeric key
 * (`00_core.sql`, `10_<domain>.sql`, …). `00_core.sql` holds the original core +
 * SPEC2 tables, so existing tables are always preserved and emitted first.
 *
 * Every module must be idempotent (`create ... if not exists`, `create or
 * replace`, guarded `do $$`) so the composed file is safe to re-run — see
 * `schema/_compose.md` for the full convention.
 *
 * Usage:  node scripts/compose-schema.mjs           (write schema.sql)
 *         node scripts/compose-schema.mjs --check    (verify it is up to date)
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_DIR = join(ROOT, "schema");
const OUTPUT = join(ROOT, "schema.sql");

const check = process.argv.includes("--check");

if (!existsSync(SCHEMA_DIR)) {
  console.error(`compose-schema: missing schema/ directory at ${SCHEMA_DIR}`);
  process.exit(1);
}

const modules = readdirSync(SCHEMA_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

if (modules.length === 0) {
  console.error("compose-schema: no schema/*.sql modules found");
  process.exit(1);
}

const banner =
  "-- ============================================================================\n" +
  "-- ProofChain — composed database schema (GENERATED, do not edit).\n" +
  "-- Source of truth: schema/*.sql modules. Regenerate with:\n" +
  "--   node scripts/compose-schema.mjs   (pnpm run schema:build)\n" +
  "-- Apply with: psql \"$SUPABASE_DB_URL\" -f schema.sql\n" +
  `-- Modules (${modules.length}): ${modules.join(", ")}\n` +
  "-- ============================================================================\n";

const sections = modules.map((name) => {
  const body = readFileSync(join(SCHEMA_DIR, name), "utf8").trimEnd();
  const head =
    "\n-- >>> module: " +
    name +
    " " +
    "-".repeat(Math.max(0, 60 - name.length)) +
    "\n";
  return `${head}${body}\n`;
});

const output = `${banner}${sections.join("")}`;

if (check) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : "";
  if (current !== output) {
    console.error(
      "compose-schema: schema.sql is OUT OF DATE. Run `pnpm run schema:build`.",
    );
    process.exit(1);
  }
  console.log(`compose-schema: schema.sql up to date (${modules.length} modules).`);
} else {
  writeFileSync(OUTPUT, output, "utf8");
  console.log(
    `compose-schema: wrote schema.sql from ${modules.length} module(s): ${modules.join(", ")}`,
  );
}
