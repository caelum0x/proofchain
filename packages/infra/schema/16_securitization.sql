-- =============================================================================
-- Trade finance — Receivable securitization read model. Populated by the
-- @proofchain/api indexer from ReceivableSecuritization + TrancheToken contracts.
-- A securitization pools receivables and issues seniority-ranked ERC20 tranches.
-- Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists securitizations (
  id              text        primary key,
  originator      text        not null check (originator ~ '^0x[0-9a-f]{40}$'),
  spv             text        check (spv is null or spv ~ '^0x[0-9a-f]{40}$'),
  token           text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  pool_value      numeric(78, 0) not null default 0 check (pool_value >= 0),
  receivable_count integer    not null default 0 check (receivable_count >= 0),
  status          text        not null default 'forming'
                             check (status in ('forming', 'issued', 'servicing',
                                               'redeemed', 'defaulted', 'closed')),
  uri             text,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists securitizations_originator_idx on securitizations (originator);
create index if not exists securitizations_status_idx      on securitizations (status);

create table if not exists tranches (
  id                text        primary key,
  securitization_id text        not null references securitizations (id) on delete cascade,
  tranche_token     text        check (tranche_token is null or tranche_token ~ '^0x[0-9a-f]{40}$'),
  seniority         integer     not null default 0 check (seniority >= 0),
  name              text,
  principal         numeric(78, 0) not null default 0 check (principal >= 0),
  coupon_bps        integer     not null default 0 check (coupon_bps between 0 and 10000),
  attachment_bps    integer     not null default 0 check (attachment_bps between 0 and 10000),
  detachment_bps    integer     not null default 10000 check (detachment_bps between 0 and 10000),
  rating            text,
  status            text        not null default 'outstanding'
                               check (status in ('outstanding', 'paying', 'defaulted', 'redeemed')),
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists tranches_securitization_idx on tranches (securitization_id);
create index if not exists tranches_token_idx           on tranches (tranche_token);
create index if not exists tranches_seniority_idx        on tranches (seniority);

do $$
declare
  t text;
  tables text[] := array['securitizations', 'tranches'];
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
