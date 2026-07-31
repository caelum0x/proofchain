-- =============================================================================
-- Logistics — Last-mile proof of delivery read model. Populated by the
-- @proofchain/api indexer from the LastMileProofOfDelivery contract. Signed
-- delivery confirmations closing out a freight leg. Conventions mirror
-- 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists proof_of_delivery (
  id            text        primary key,
  shipment_id   text        check (shipment_id is null or shipment_id ~ '^0x[0-9a-f]{64}$'),
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  courier       text        check (courier is null or courier ~ '^0x[0-9a-f]{40}$'),
  recipient     text        check (recipient is null or recipient ~ '^0x[0-9a-f]{40}$'),
  status        text        not null default 'delivered'
                            check (status in ('out_for_delivery', 'delivered', 'failed',
                                              'returned', 'disputed')),
  signature_uri text,
  proof_hash    text        check (proof_hash is null or proof_hash ~ '^0x[0-9a-f]{64}$'),
  location      text,
  delivered_at  timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists proof_of_delivery_shipment_idx on proof_of_delivery (shipment_id);
create index if not exists proof_of_delivery_batch_idx     on proof_of_delivery (batch_id);
create index if not exists proof_of_delivery_courier_idx    on proof_of_delivery (courier);
create index if not exists proof_of_delivery_status_idx      on proof_of_delivery (status);

do $$
declare
  t text;
  tables text[] := array['proof_of_delivery'];
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
