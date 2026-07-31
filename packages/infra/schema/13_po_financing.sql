-- =============================================================================
-- Trade finance — Purchase-order financing read model. Populated by the
-- @proofchain/api indexer from the PurchaseOrderFinancing contract. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps rates, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists po_financings (
  id            text        primary key,
  po_number     text,
  buyer         text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  supplier      text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  financier     text        check (financier is null or financier ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  po_amount     numeric(78, 0) not null default 0 check (po_amount >= 0),
  funded_amount numeric(78, 0) not null default 0 check (funded_amount >= 0),
  rate_bps      integer     not null default 0 check (rate_bps between 0 and 10000),
  status        text        not null default 'requested'
                            check (status in ('requested', 'approved', 'funded',
                                              'fulfilled', 'repaid', 'defaulted', 'cancelled')),
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  due_date      timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists po_financings_buyer_idx     on po_financings (buyer);
create index if not exists po_financings_supplier_idx   on po_financings (supplier);
create index if not exists po_financings_financier_idx    on po_financings (financier);
create index if not exists po_financings_status_idx        on po_financings (status);

do $$
declare
  t text;
  tables text[] := array['po_financings'];
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
