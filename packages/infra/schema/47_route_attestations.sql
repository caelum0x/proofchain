-- =============================================================================
-- Logistics — Route attestations read model. Populated by the @proofchain/api
-- indexer from the RouteAttestation contract. Signed geo/waypoint attestations
-- proving a shipment followed an agreed route. Conventions mirror 00_core.sql
-- (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists route_attestations (
  id            text        primary key,
  shipment_id   text        check (shipment_id is null or shipment_id ~ '^0x[0-9a-f]{64}$'),
  attestor      text        not null check (attestor ~ '^0x[0-9a-f]{40}$'),
  waypoint      text,
  latitude_e7   bigint,
  longitude_e7  bigint,
  sequence_no   integer     not null default 0 check (sequence_no >= 0),
  deviation_m   numeric(20, 4),
  on_route      boolean     not null default true,
  attested_at   timestamptz not null default now(),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists route_attestations_shipment_idx on route_attestations (shipment_id);
create index if not exists route_attestations_attestor_idx  on route_attestations (attestor);
create index if not exists route_attestations_seq_idx        on route_attestations (shipment_id, sequence_no);

do $$
declare
  t text;
  tables text[] := array['route_attestations'];
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
