-- =============================================================================
-- Trade finance — invoices read model.
-- =============================================================================
-- Commercial invoices backing factoring / PO financing, populated by the
-- @proofchain/api indexer. Same conventions as 00_core.sql:
--   * On-chain identifiers as lowercase hex `text` with a format CHECK.
--   * uint256 amounts as numeric(78,0); `updated_at` via set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists invoices (
  id          text        primary key,
  batch_id    text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  seller      text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  buyer       text        check (buyer is null or buyer ~ '^0x[0-9a-f]{40}$'),
  token       text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount      numeric(78, 0) not null default 0 check (amount >= 0),
  currency    text,
  due_date    timestamptz,
  status      text        not null default 'issued'
                          check (status in ('draft', 'issued', 'paid', 'overdue',
                                            'cancelled', 'financed')),
  uri         text,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invoices_seller_idx  on invoices (seller);
create index if not exists invoices_buyer_idx    on invoices (buyer);
create index if not exists invoices_status_idx    on invoices (status);
create index if not exists invoices_batch_idx      on invoices (batch_id);

drop trigger if exists invoices_set_updated_at on invoices;
create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

alter table invoices enable row level security;
drop policy if exists invoices_read_all on invoices;
create policy invoices_read_all
  on invoices for select
  to anon, authenticated
  using (true);
