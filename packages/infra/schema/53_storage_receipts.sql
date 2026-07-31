-- =============================================================================
-- Commodities — Storage receipts read model. Populated by the @proofchain/api
-- indexer from the StorageReceipt contract. Negotiable warehouse receipts
-- representing stored commodity that can collateralize financing. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) quantities, RLS, idempotent).
-- =============================================================================

create table if not exists storage_receipts (
  id            text        primary key,
  warehouse_id  text,
  depositor     text        not null check (depositor ~ '^0x[0-9a-f]{40}$'),
  holder        text        check (holder is null or holder ~ '^0x[0-9a-f]{40}$'),
  commodity_id  text,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  quantity      numeric(78, 0) not null default 0 check (quantity >= 0),
  unit          text,
  status        text        not null default 'issued'
                            check (status in ('issued', 'pledged', 'transferred',
                                              'redeemed', 'cancelled')),
  expiry_date   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists storage_receipts_depositor_idx on storage_receipts (depositor);
create index if not exists storage_receipts_holder_idx     on storage_receipts (holder);
create index if not exists storage_receipts_warehouse_idx   on storage_receipts (warehouse_id);
create index if not exists storage_receipts_status_idx       on storage_receipts (status);

do $$
declare
  t text;
  tables text[] := array['storage_receipts'];
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
