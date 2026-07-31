-- =============================================================================
-- Trade finance — Factoring agreements read model. Populated by the
-- @proofchain/api indexer from the FactoringAgreement contract. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps scores, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists factoring_agreements (
  id             text        primary key,
  invoice_id     text        check (invoice_id is null or invoice_id ~ '^0x[0-9a-f]{64}$'),
  seller         text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  factor         text        not null check (factor ~ '^0x[0-9a-f]{40}$'),
  token          text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  face_value     numeric(78, 0) not null default 0 check (face_value >= 0),
  advance_amount numeric(78, 0) not null default 0 check (advance_amount >= 0),
  advance_bps    integer     not null default 0 check (advance_bps between 0 and 10000),
  discount_bps   integer     not null default 0 check (discount_bps between 0 and 10000),
  recourse       boolean     not null default true,
  status         text        not null default 'proposed'
                             check (status in ('proposed', 'active', 'collected',
                                               'defaulted', 'settled', 'cancelled')),
  maturity_date  timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists factoring_agreements_seller_idx  on factoring_agreements (seller);
create index if not exists factoring_agreements_factor_idx   on factoring_agreements (factor);
create index if not exists factoring_agreements_status_idx    on factoring_agreements (status);
create index if not exists factoring_agreements_invoice_idx    on factoring_agreements (invoice_id);

do $$
declare
  t text;
  tables text[] := array['factoring_agreements'];
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
