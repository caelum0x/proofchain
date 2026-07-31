-- =============================================================================
-- DPP — Digital Product Passport lifecycle events read model. Populated by the
-- @proofchain/api indexer from the DPPLifecycleRegistry contract. Append-only
-- lifecycle log (manufactured → sold → repaired → recycled) per passport token.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists dpp_lifecycle_events (
  id            text        primary key,
  token_id      text        not null,
  passport_id   text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  event_type    text        not null default 'manufactured'
                            check (event_type in ('manufactured', 'shipped', 'sold', 'installed',
                                                  'serviced', 'repaired', 'resold', 'refurbished',
                                                  'decommissioned', 'recycled', 'disposed')),
  actor         text        check (actor is null or actor ~ '^0x[0-9a-f]{40}$'),
  location      text,
  occurred_at   timestamptz not null default now(),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists dpp_lifecycle_events_token_idx  on dpp_lifecycle_events (token_id);
create index if not exists dpp_lifecycle_events_type_idx    on dpp_lifecycle_events (event_type);
create index if not exists dpp_lifecycle_events_occurred_idx on dpp_lifecycle_events (occurred_at);

do $$
declare
  t text;
  tables text[] := array['dpp_lifecycle_events'];
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
