-- =============================================================================
-- DPP — Material composition read model. Populated by the @proofchain/api indexer
-- from the MaterialComposition contract. Per-passport bill of materials with
-- recycled-content and hazardous-substance flags (EU DPP requirement).
-- Conventions mirror 00_core.sql (hex CHECKs, bps fractions, RLS, idempotent).
-- =============================================================================

create table if not exists material_compositions (
  id             text        primary key,
  token_id       text        not null,
  passport_id    text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  material       text        not null,
  cas_number     text,
  mass_bps       integer     not null default 0 check (mass_bps between 0 and 10000),
  recycled_bps   integer     not null default 0 check (recycled_bps between 0 and 10000),
  hazardous      boolean     not null default false,
  origin_country text,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists material_compositions_token_idx     on material_compositions (token_id);
create index if not exists material_compositions_material_idx   on material_compositions (material);
create index if not exists material_compositions_hazardous_idx   on material_compositions (hazardous);

do $$
declare
  t text;
  tables text[] := array['material_compositions'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_read_all on %I', t, t);
    execute format('create policy %I_read_all on %I for select to anon, authenticated using (true)', t, t);
  end loop;
end
$$;
