# Schema composition convention

The root **`schema.sql`** is a **generated artifact**. Do not edit it by hand.
It is the concatenation of the per-domain SQL modules in this directory, produced
by `scripts/compose-schema.mjs` (`pnpm run schema:build`).

## Why

`schema.sql` is the single file the deploy path applies
(`psql "$SUPABASE_DB_URL" -f schema.sql`, or pasted into the Supabase SQL editor)
and it is exported from the package as `@proofchain/infra/schema.sql`. Splitting
it into modules lets Fill agents add one domain at a time **without ever editing a
shared file or risking a merge conflict** — you add a module, run the composer,
and the artifact is regenerated deterministically.

## Fill convention (add a domain)

1. Create a new file `schema/<NN>_<domain>.sql` where `<NN>` is a two-digit
   ordering key (see the ranges below). One domain per file.
2. Write **idempotent** DDL only:
   - Tables: `create table if not exists …`.
   - Functions: `create or replace function …`.
   - Enums / triggers / policies: guard with `do $$ … end $$;` blocks that check
     `pg_type` / use `drop … if exists` before `create`.
   - This guarantees the composed `schema.sql` is safe to re-run on every deploy.
3. Follow the existing column conventions (mirrored by the zod schemas in
   `src/types.ts` and the repositories in `src/repositories/`):
   - On-chain identifiers: lowercase hex `text` with a `check (col ~ '^0x[0-9a-f]{64}$')`
     (32-byte) or `'^0x[0-9a-f]{40}$'` (address) constraint.
   - `uint256` amounts: `numeric(78, 0)` with `check (col >= 0)`.
   - Basis-point scores: `integer check (col between 0 and 10000)`.
   - Timestamps: `created_at` / `updated_at timestamptz not null default now()`.
   - Attach the shared `set_updated_at()` trigger to any table with `updated_at`.
   - Enable RLS (`alter table … enable row level security`) with a public
     read-only `select` policy; all writes go through the service role.
4. Run `pnpm run schema:build` to regenerate `schema.sql`.
   CI can assert freshness with `pnpm run schema:build -- --check`.

## Ordering ranges

| Key range | Purpose                                             |
| --------- | --------------------------------------------------- |
| `00`      | Core + SPEC2 tables (`00_core.sql`) — do not split. |
| `10`–`19` | Trade finance                                       |
| `20`–`29` | Compliance                                          |
| `30`–`39` | Digital Product Passport (DPP)                      |
| `40`–`49` | Logistics                                           |
| `50`–`59` | Commodities / energy / ESG                          |
| `60`–`69` | Workforce                                           |
| `70`–`79` | Data / oracle                                       |
| `90`–`99` | Infra internals (queue, outbox, migrations, …)      |

`00_core.sql` is the verbatim original schema, so **existing tables are always
emitted first and never dropped**. Modules only ever add new objects.
