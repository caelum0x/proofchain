-- =============================================================================
-- Logistics — freight bookings read model. Populated by the @proofchain/api
-- indexer from the FreightBooking contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists freight (
  id           text        primary key,
  batch_id     text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  shipper      text        check (shipper is null or shipper ~ '^0x[0-9a-f]{40}$'),
  carrier      text        check (carrier is null or carrier ~ '^0x[0-9a-f]{40}$'),
  origin       text,
  destination  text,
  status       text        not null default 'booked'
                           check (status in ('booked', 'in_transit', 'delivered', 'cancelled')),
  eta          timestamptz,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists freight_batch_idx    on freight (batch_id);
create index if not exists freight_shipper_idx    on freight (shipper);
create index if not exists freight_carrier_idx     on freight (carrier);
create index if not exists freight_status_idx       on freight (status);

drop trigger if exists freight_set_updated_at on freight;
create trigger freight_set_updated_at
  before update on freight
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['freight'];
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
