-- =============================================================================
-- Workforce — payroll read model. Mirrors the MilestonePayroll contract: worker
-- stablecoin payouts gated on delivery milestones. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * uint256 amounts as numeric(78,0) with a `>= 0` CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists payroll (
  id          text        primary key,
  worker      text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  employer    text        check (employer is null or employer ~ '^0x[0-9a-f]{40}$'),
  token       text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount      numeric(78, 0) not null default 0 check (amount >= 0),
  milestone   text,
  status      text        not null default 'pending'
                          check (status in ('pending', 'approved', 'paid', 'cancelled')),
  paid_at     timestamptz,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists payroll_worker_idx    on payroll (worker);
create index if not exists payroll_employer_idx    on payroll (employer);
create index if not exists payroll_status_idx       on payroll (status);

drop trigger if exists payroll_set_updated_at on payroll;
create trigger payroll_set_updated_at
  before update on payroll
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['payroll'];
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
