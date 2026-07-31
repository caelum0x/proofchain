-- =============================================================================
-- Commodities — tokens, vaults and price oracle read model. Populated by the
-- @proofchain/api indexer from CommodityToken / CommodityVault / PriceOracle
-- contracts. Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts,
-- RLS, idempotent DDL).
-- =============================================================================

create table if not exists commodities (
  id            text        primary key,
  symbol        text        not null,
  name          text,
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  category      text        not null default 'agri'
                            check (category in ('agri', 'metal', 'energy', 'soft', 'livestock', 'other')),
  unit          text,
  decimals      integer     not null default 18 check (decimals between 0 and 36),
  total_supply  numeric(78, 0) not null default 0 check (total_supply >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'delisted', 'suspended')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists commodities_symbol_key on commodities (symbol);
create index if not exists commodities_token_idx          on commodities (token);
create index if not exists commodities_category_idx        on commodities (category);

create table if not exists commodity_vaults (
  id            text        primary key,
  commodity_id  text        references commodities (id) on delete set null,
  custodian     text        check (custodian is null or custodian ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  collateral    numeric(78, 0) not null default 0 check (collateral >= 0),
  minted        numeric(78, 0) not null default 0 check (minted >= 0),
  status        text        not null default 'open'
                            check (status in ('open', 'locked', 'redeemed', 'liquidated')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists commodity_vaults_commodity_idx on commodity_vaults (commodity_id);
create index if not exists commodity_vaults_custodian_idx  on commodity_vaults (custodian);

create table if not exists commodity_prices (
  id            text        primary key,
  commodity_id  text        references commodities (id) on delete cascade,
  symbol        text,
  price         numeric(78, 0) not null default 0 check (price >= 0),
  currency      text        not null default 'USD',
  source        text,
  observed_at   timestamptz not null default now(),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists commodity_prices_commodity_idx on commodity_prices (commodity_id);
create index if not exists commodity_prices_observed_idx   on commodity_prices (observed_at);

do $$
declare
  t text;
  tables text[] := array['commodities', 'commodity_vaults', 'commodity_prices'];
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
