-- =============================================================================
-- Data / oracle — IoT sensors read model. Mirrors the IoTSensorRegistry
-- contract: device registration + latest reading per sensor. Design rules
-- mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists sensors (
  id            text        primary key,
  device_id     text        not null,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  sensor_type   text,
  location      text,
  last_reading  numeric,
  unit          text,
  status        text        not null default 'active'
                            check (status in ('active', 'inactive', 'faulty')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sensors_device_idx  on sensors (device_id);
create index if not exists sensors_batch_idx     on sensors (batch_id);
create index if not exists sensors_status_idx     on sensors (status);

drop trigger if exists sensors_set_updated_at on sensors;
create trigger sensors_set_updated_at
  before update on sensors
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['sensors'];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_read_all on %I', t, t);
    execute format(
      'create policy %I_read_all on %I for select to anon, authenticated using (true)',
      t, t
    );
  end loop;
end
$$;
