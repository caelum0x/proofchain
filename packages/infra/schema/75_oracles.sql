-- =============================================================================
-- Data/oracle — Oracle aggregator read model. Populated by the @proofchain/api
-- indexer from the OracleAggregator contract. Registered oracle feeds and their
-- aggregated observations (median of submissions). Conventions mirror
-- 00_core.sql (hex CHECKs, numeric values, RLS, idempotent DDL).
-- =============================================================================

create table if not exists oracle_feeds (
  id            text        primary key,
  feed_key      text        not null,
  description   text,
  decimals      integer     not null default 8 check (decimals between 0 and 36),
  min_answers   integer     not null default 1 check (min_answers >= 1),
  status        text        not null default 'active'
                            check (status in ('active', 'paused', 'deprecated')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists oracle_feeds_key_key on oracle_feeds (feed_key);
create index if not exists oracle_feeds_status_idx       on oracle_feeds (status);

create table if not exists oracle_observations (
  id            text        primary key,
  feed_id       text        not null references oracle_feeds (id) on delete cascade,
  round_id      numeric(78, 0) not null default 0 check (round_id >= 0),
  answer        numeric(78, 0) not null default 0,
  answer_count  integer     not null default 0 check (answer_count >= 0),
  reporter      text        check (reporter is null or reporter ~ '^0x[0-9a-f]{40}$'),
  observed_at   timestamptz not null default now(),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists oracle_observations_feed_idx  on oracle_observations (feed_id);
create index if not exists oracle_observations_round_idx  on oracle_observations (feed_id, round_id);

do $$
declare
  t text;
  tables text[] := array['oracle_feeds', 'oracle_observations'];
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
