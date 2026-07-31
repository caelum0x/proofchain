-- =============================================================================
-- Infra internals — durable backends for the queue, outbox and migration runner.
-- =============================================================================
-- These tables back the Supabase-backed implementations of the in-memory
-- primitives shipped in src/queue, src/events and src/migrations. They are
-- server-internal: RLS is enabled with NO public policy, so anon/authenticated
-- access is denied and only the service role (which bypasses RLS) can touch them.
-- Idempotent like every module — safe to re-run.
-- =============================================================================

-- --- Generic job queue -------------------------------------------------------
create table if not exists queue_jobs (
  id           uuid        primary key default gen_random_uuid(),
  queue        text        not null default 'default',
  type         text        not null,
  payload      jsonb       not null default '{}'::jsonb,
  status       text        not null default 'pending'
                          check (status in ('pending', 'processing', 'succeeded', 'failed', 'dead')),
  attempts     integer     not null default 0 check (attempts >= 0),
  max_attempts integer     not null default 3 check (max_attempts >= 1),
  run_at       timestamptz not null default now(),
  locked_at    timestamptz,
  last_error   jsonb,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists queue_jobs_poll_idx   on queue_jobs (queue, status, run_at);
create index if not exists queue_jobs_status_idx  on queue_jobs (status);

-- --- Transactional outbox ----------------------------------------------------
create table if not exists outbox_events (
  id           uuid        primary key default gen_random_uuid(),
  aggregate    text        not null,
  aggregate_id text        not null,
  type         text        not null,
  payload      jsonb       not null default '{}'::jsonb,
  status       text        not null default 'pending'
                          check (status in ('pending', 'published', 'failed')),
  attempts     integer     not null default 0 check (attempts >= 0),
  published_at timestamptz,
  last_error   jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists outbox_events_poll_idx    on outbox_events (status, created_at);
create index if not exists outbox_events_aggregate_idx on outbox_events (aggregate, aggregate_id);

-- --- Applied migrations ledger ------------------------------------------------
create table if not exists schema_migrations (
  id          text        primary key,
  name        text        not null,
  checksum    text,
  applied_at  timestamptz not null default now()
);

-- --- updated_at triggers ------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['queue_jobs', 'outbox_events'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end
$$;

-- --- RLS: enabled, no public policy (server-only, service role bypasses) ------
do $$
declare
  t text;
  tables text[] := array['queue_jobs', 'outbox_events', 'schema_migrations'];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
  end loop;
end
$$;
