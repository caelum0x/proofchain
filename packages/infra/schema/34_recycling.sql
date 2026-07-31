-- =============================================================================
-- DPP — Recycling registry read model. Populated by the @proofchain/api indexer
-- from the RecyclingRegistry contract. Records end-of-life recycling/recovery of
-- a passported product and the material recovery achieved. Conventions mirror
-- 00_core.sql (hex CHECKs, numeric(78,0) mass, bps recovery, RLS, idempotent).
-- =============================================================================

create table if not exists recycling_records (
  id             text        primary key,
  token_id       text,
  passport_id    text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  recycler       text        not null check (recycler ~ '^0x[0-9a-f]{40}$'),
  method         text        not null default 'mechanical'
                             check (method in ('mechanical', 'chemical', 'thermal',
                                               'refurbish', 'reuse', 'landfill')),
  input_mass_g   numeric(78, 0) not null default 0 check (input_mass_g >= 0),
  recovered_mass_g numeric(78, 0) not null default 0 check (recovered_mass_g >= 0),
  recovery_bps   integer     not null default 0 check (recovery_bps between 0 and 10000),
  status         text        not null default 'recorded'
                             check (status in ('recorded', 'verified', 'disputed')),
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists recycling_records_token_idx    on recycling_records (token_id);
create index if not exists recycling_records_recycler_idx  on recycling_records (recycler);
create index if not exists recycling_records_method_idx     on recycling_records (method);

do $$
declare
  t text;
  tables text[] := array['recycling_records'];
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
