-- =============================================================================
-- Growth — referrals read model. Tracks referrer/referee relationships and the
-- reward owed on conversion. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * uint256 reward amounts as numeric(78,0) with a `>= 0` CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists referrals (
  id             text        primary key,
  referrer       text        not null check (referrer ~ '^0x[0-9a-f]{40}$'),
  referee        text        check (referee is null or referee ~ '^0x[0-9a-f]{40}$'),
  code           text,
  status         text        not null default 'pending'
                             check (status in ('pending', 'converted', 'rewarded', 'expired')),
  reward_amount  numeric(78, 0) not null default 0 check (reward_amount >= 0),
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists referrals_referrer_idx  on referrals (referrer);
create index if not exists referrals_referee_idx     on referrals (referee);
create index if not exists referrals_code_idx         on referrals (code);
create index if not exists referrals_status_idx        on referrals (status);

drop trigger if exists referrals_set_updated_at on referrals;
create trigger referrals_set_updated_at
  before update on referrals
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['referrals'];
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
