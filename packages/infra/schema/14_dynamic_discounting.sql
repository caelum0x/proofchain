-- =============================================================================
-- Trade finance — Dynamic discounting read model. Populated by the
-- @proofchain/api indexer from the DynamicDiscounting contract. Early-payment
-- offers against approved invoices with a sliding APR curve. Conventions mirror
-- 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps rates, RLS, idempotent).
-- =============================================================================

create table if not exists dynamic_discounts (
  id             text        primary key,
  invoice_id     text        check (invoice_id is null or invoice_id ~ '^0x[0-9a-f]{64}$'),
  buyer          text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  supplier       text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  token          text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  face_value     numeric(78, 0) not null default 0 check (face_value >= 0),
  discount_amount numeric(78, 0) not null default 0 check (discount_amount >= 0),
  apr_bps        integer     not null default 0 check (apr_bps between 0 and 10000),
  days_early     integer     not null default 0 check (days_early >= 0),
  status         text        not null default 'offered'
                             check (status in ('offered', 'accepted', 'paid',
                                               'expired', 'declined')),
  offer_expiry   timestamptz,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists dynamic_discounts_buyer_idx     on dynamic_discounts (buyer);
create index if not exists dynamic_discounts_supplier_idx   on dynamic_discounts (supplier);
create index if not exists dynamic_discounts_status_idx      on dynamic_discounts (status);
create index if not exists dynamic_discounts_invoice_idx      on dynamic_discounts (invoice_id);

do $$
declare
  t text;
  tables text[] := array['dynamic_discounts'];
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
