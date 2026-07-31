-- =============================================================================
-- Logistics — Fleet registry read model. Populated by the @proofchain/api indexer
-- from the FleetRegistry contract. Vehicles/vessels/aircraft available to
-- carriers for freight assignment. Conventions mirror 00_core.sql (hex CHECKs,
-- RLS, idempotent DDL).
-- =============================================================================

create table if not exists fleet_vehicles (
  id            text        primary key,
  carrier       text        not null check (carrier ~ '^0x[0-9a-f]{40}$'),
  vehicle_type  text        not null default 'truck'
                            check (vehicle_type in ('truck', 'van', 'rail', 'vessel',
                                                    'aircraft', 'barge', 'reefer')),
  identifier    text,
  capacity_kg   numeric(78, 0) not null default 0 check (capacity_kg >= 0),
  reefer        boolean     not null default false,
  status        text        not null default 'available'
                            check (status in ('available', 'assigned', 'in_transit',
                                              'maintenance', 'retired')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists fleet_vehicles_carrier_idx on fleet_vehicles (carrier);
create index if not exists fleet_vehicles_type_idx     on fleet_vehicles (vehicle_type);
create index if not exists fleet_vehicles_status_idx    on fleet_vehicles (status);

do $$
declare
  t text;
  tables text[] := array['fleet_vehicles'];
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
