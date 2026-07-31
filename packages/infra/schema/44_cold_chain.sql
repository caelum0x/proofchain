-- =============================================================================
-- Logistics — Cold-chain monitoring read model. Populated by the @proofchain/api
-- indexer from the ColdChainMonitor contract. Per-shipment temperature readings
-- and breach events (drives parametric cargo insurance payouts). Conventions
-- mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists cold_chain_readings (
  id             text        primary key,
  shipment_id    text        check (shipment_id is null or shipment_id ~ '^0x[0-9a-f]{64}$'),
  container_id   text,
  sensor         text        check (sensor is null or sensor ~ '^0x[0-9a-f]{40}$'),
  temperature_c  numeric(10, 4),
  humidity_bps   integer     check (humidity_bps is null or humidity_bps between 0 and 10000),
  min_threshold_c numeric(10, 4),
  max_threshold_c numeric(10, 4),
  breach         boolean     not null default false,
  recorded_at    timestamptz not null default now(),
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cold_chain_readings_shipment_idx on cold_chain_readings (shipment_id);
create index if not exists cold_chain_readings_container_idx on cold_chain_readings (container_id);
create index if not exists cold_chain_readings_breach_idx    on cold_chain_readings (breach);
create index if not exists cold_chain_readings_recorded_idx   on cold_chain_readings (recorded_at);

do $$
declare
  t text;
  tables text[] := array['cold_chain_readings'];
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
