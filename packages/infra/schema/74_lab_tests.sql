-- =============================================================================
-- Data / oracle — lab test attestations read model. Mirrors the
-- LabTestAttestation contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists lab_tests (
  id           text        primary key,
  batch_id     text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  lab          text        check (lab is null or lab ~ '^0x[0-9a-f]{40}$'),
  test_type    text,
  result       text        not null default 'pending'
                           check (result in ('pending', 'passed', 'failed')),
  report_hash  text        check (report_hash is null or report_hash ~ '^0x[0-9a-f]{64}$'),
  report_uri   text,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists lab_tests_batch_idx  on lab_tests (batch_id);
create index if not exists lab_tests_lab_idx      on lab_tests (lab);
create index if not exists lab_tests_result_idx    on lab_tests (result);

drop trigger if exists lab_tests_set_updated_at on lab_tests;
create trigger lab_tests_set_updated_at
  before update on lab_tests
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['lab_tests'];
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
