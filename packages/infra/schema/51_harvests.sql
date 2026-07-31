-- =============================================================================
-- Commodities — Harvest registry read model. Populated by the @proofchain/api
-- indexer from the HarvestRegistry contract. Registers agricultural harvests
-- (farm, crop, yield) that seed provenance batches. Conventions mirror
-- 00_core.sql (hex CHECKs, numeric(78,0) yields, RLS, idempotent DDL).
-- =============================================================================

create table if not exists harvests (
  id            text        primary key,
  farmer        text        not null check (farmer ~ '^0x[0-9a-f]{40}$'),
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  crop          text,
  variety       text,
  yield_kg      numeric(78, 0) not null default 0 check (yield_kg >= 0),
  region        text,
  organic       boolean     not null default false,
  harvested_at  timestamptz,
  status        text        not null default 'recorded'
                            check (status in ('recorded', 'graded', 'stored', 'sold', 'spoiled')),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists harvests_farmer_idx on harvests (farmer);
create index if not exists harvests_batch_idx   on harvests (batch_id);
create index if not exists harvests_crop_idx     on harvests (crop);
create index if not exists harvests_status_idx    on harvests (status);

do $$
declare
  t text;
  tables text[] := array['harvests'];
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
