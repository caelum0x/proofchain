-- =============================================================================
-- Workforce — Safety training registry read model. Populated by the
-- @proofchain/api indexer from the SafetyTrainingRegistry contract. Completion
-- records for occupational safety courses per worker. Conventions mirror
-- 00_core.sql (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists safety_trainings (
  id            text        primary key,
  worker        text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  provider      text        check (provider is null or provider ~ '^0x[0-9a-f]{40}$'),
  course        text        not null,
  course_code   text,
  score_bps     integer     not null default 0 check (score_bps between 0 and 10000),
  result        text        not null default 'passed'
                            check (result in ('passed', 'failed', 'in_progress')),
  status        text        not null default 'valid'
                            check (status in ('valid', 'expired', 'revoked')),
  completed_at  timestamptz,
  expiry_date   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists safety_trainings_worker_idx   on safety_trainings (worker);
create index if not exists safety_trainings_provider_idx  on safety_trainings (provider);
create index if not exists safety_trainings_status_idx     on safety_trainings (status);

do $$
declare
  t text;
  tables text[] := array['safety_trainings'];
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
