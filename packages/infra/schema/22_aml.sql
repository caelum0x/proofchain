-- =============================================================================
-- Compliance — AML registry read model. Populated by the @proofchain/api indexer
-- from the AMLRegistry contract. Per-subject AML risk ratings and flags.
-- Conventions mirror 00_core.sql (hex CHECKs, bps risk scores, RLS, idempotent).
-- =============================================================================

create table if not exists aml_records (
  id            text        primary key,
  subject       text        not null check (subject ~ '^0x[0-9a-f]{40}$'),
  risk_level    text        not null default 'low'
                            check (risk_level in ('low', 'medium', 'high', 'prohibited')),
  risk_score    integer     not null default 0 check (risk_score between 0 and 10000),
  status        text        not null default 'active'
                            check (status in ('active', 'under_review', 'cleared', 'flagged')),
  flags         jsonb       not null default '[]'::jsonb,
  assessor      text        check (assessor is null or assessor ~ '^0x[0-9a-f]{40}$'),
  reviewed_at   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists aml_records_subject_idx    on aml_records (subject);
create index if not exists aml_records_risk_level_idx  on aml_records (risk_level);
create index if not exists aml_records_status_idx       on aml_records (status);

do $$
declare
  t text;
  tables text[] := array['aml_records'];
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
