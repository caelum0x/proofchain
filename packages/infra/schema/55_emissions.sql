-- =============================================================================
-- Energy/ESG — Emissions trading read model. Populated by the @proofchain/api
-- indexer from the EmissionsTrading contract. Allowance allocations and trades
-- in a cap-and-trade scheme (tonnes CO2e). Conventions mirror 00_core.sql
-- (hex CHECKs, numeric(78,0) volumes, RLS, idempotent DDL).
-- =============================================================================

create table if not exists emission_allowances (
  id            text        primary key,
  account       text        not null check (account ~ '^0x[0-9a-f]{40}$'),
  scheme        text,
  vintage_year  integer     check (vintage_year is null or vintage_year between 1990 and 2100),
  allocated     numeric(78, 0) not null default 0 check (allocated >= 0),
  surrendered   numeric(78, 0) not null default 0 check (surrendered >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'surrendered', 'expired', 'cancelled')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists emission_allowances_account_idx on emission_allowances (account);
create index if not exists emission_allowances_status_idx   on emission_allowances (status);

create table if not exists emission_trades (
  id            text        primary key,
  seller        text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  buyer         text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  volume        numeric(78, 0) not null default 0 check (volume >= 0),
  price         numeric(78, 0) not null default 0 check (price >= 0),
  status        text        not null default 'settled'
                            check (status in ('pending', 'settled', 'cancelled')),
  traded_at     timestamptz not null default now(),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists emission_trades_seller_idx on emission_trades (seller);
create index if not exists emission_trades_buyer_idx   on emission_trades (buyer);
create index if not exists emission_trades_traded_idx   on emission_trades (traded_at);

do $$
declare
  t text;
  tables text[] := array['emission_allowances', 'emission_trades'];
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
