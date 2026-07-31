-- =============================================================================
-- Data/oracle — Data marketplace read model. Populated by the @proofchain/api
-- indexer from the DataMarketplace contract. Listings of datasets/streams for
-- sale plus purchase/access grants. Conventions mirror 00_core.sql (hex CHECKs,
-- numeric(78,0) prices, RLS, idempotent DDL).
-- =============================================================================

create table if not exists data_listings (
  id            text        primary key,
  seller        text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  title         text,
  category      text,
  price         numeric(78, 0) not null default 0 check (price >= 0),
  license       text,
  sample_uri    text,
  status        text        not null default 'active'
                            check (status in ('active', 'paused', 'sold_out', 'delisted')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists data_listings_seller_idx   on data_listings (seller);
create index if not exists data_listings_category_idx  on data_listings (category);
create index if not exists data_listings_status_idx     on data_listings (status);

create table if not exists data_purchases (
  id            text        primary key,
  listing_id    text        not null references data_listings (id) on delete cascade,
  buyer         text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  price         numeric(78, 0) not null default 0 check (price >= 0),
  access_uri    text,
  status        text        not null default 'granted'
                            check (status in ('pending', 'granted', 'revoked', 'refunded')),
  expires_at    timestamptz,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists data_purchases_listing_idx on data_purchases (listing_id);
create index if not exists data_purchases_buyer_idx    on data_purchases (buyer);
create index if not exists data_purchases_status_idx    on data_purchases (status);

do $$
declare
  t text;
  tables text[] := array['data_listings', 'data_purchases'];
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
