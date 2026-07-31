-- =============================================================================
-- Data / oracle — quality inspections read model. Mirrors the QualityInspection
-- contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * Basis-point scores CHECK-constrained 0..10000.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists inspections (
  id               text        primary key,
  batch_id         text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  inspector        text        check (inspector is null or inspector ~ '^0x[0-9a-f]{40}$'),
  inspection_type  text,
  result           text        not null default 'pending'
                               check (result in ('pending', 'passed', 'failed', 'waived')),
  score            integer     check (score is null or score between 0 and 10000),
  report_uri       text,
  metadata         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists inspections_batch_idx      on inspections (batch_id);
create index if not exists inspections_inspector_idx    on inspections (inspector);
create index if not exists inspections_result_idx        on inspections (result);

drop trigger if exists inspections_set_updated_at on inspections;
create trigger inspections_set_updated_at
  before update on inspections
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['inspections'];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_read_all on %I', t, t);
    execute format(
      'create policy %I_read_all on %I for select to anon, authenticated using (true)',
      t, t
    );
  end loop;
end
$$;
