-- =============================================================================
-- Commodities — Grading registry read model. Populated by the @proofchain/api
-- indexer from the GradingRegistry contract. Quality grades assigned to
-- harvests/batches by accredited graders. Conventions mirror 00_core.sql
-- (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists gradings (
  id            text        primary key,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  harvest_id    text,
  grader        text        not null check (grader ~ '^0x[0-9a-f]{40}$'),
  grade         text        not null,
  score_bps     integer     not null default 0 check (score_bps between 0 and 10000),
  standard      text,
  status        text        not null default 'graded'
                            check (status in ('graded', 'verified', 'disputed', 'revoked')),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists gradings_batch_idx   on gradings (batch_id);
create index if not exists gradings_harvest_idx  on gradings (harvest_id);
create index if not exists gradings_grader_idx    on gradings (grader);
create index if not exists gradings_grade_idx      on gradings (grade);

do $$
declare
  t text;
  tables text[] := array['gradings'];
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
