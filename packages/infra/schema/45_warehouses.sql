-- =============================================================================
-- Logistics — Bonded warehouse registry read model. Populated by the
-- @proofchain/api indexer from the BondedWarehouse contract. Registered
-- warehouses plus bonded inventory positions held under customs suspension.
-- Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) quantities, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists warehouses (
  id            text        primary key,
  operator      text        not null check (operator ~ '^0x[0-9a-f]{40}$'),
  name          text,
  location      text,
  bonded        boolean     not null default false,
  capacity      numeric(78, 0) not null default 0 check (capacity >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'full', 'suspended', 'closed')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists warehouses_operator_idx on warehouses (operator);
create index if not exists warehouses_status_idx    on warehouses (status);

create table if not exists warehouse_positions (
  id            text        primary key,
  warehouse_id  text        not null references warehouses (id) on delete cascade,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  quantity      numeric(78, 0) not null default 0 check (quantity >= 0),
  status        text        not null default 'stored'
                            check (status in ('stored', 'released', 'seized', 'transferred')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists warehouse_positions_warehouse_idx on warehouse_positions (warehouse_id);
create index if not exists warehouse_positions_batch_idx      on warehouse_positions (batch_id);
create index if not exists warehouse_positions_owner_idx       on warehouse_positions (owner);

do $$
declare
  t text;
  tables text[] := array['warehouses', 'warehouse_positions'];
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
