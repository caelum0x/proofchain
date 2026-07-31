-- =============================================================================
-- Workforce — Labor compliance registry read model. Populated by the
-- @proofchain/api indexer from the LaborComplianceRegistry contract. Audits of
-- an employer/site against labor standards (child labor, wages, hours, safety).
-- Conventions mirror 00_core.sql (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists labor_compliance_audits (
  id            text        primary key,
  employer      text        not null check (employer ~ '^0x[0-9a-f]{40}$'),
  auditor       text        check (auditor is null or auditor ~ '^0x[0-9a-f]{40}$'),
  site          text,
  standard      text,
  score_bps     integer     not null default 0 check (score_bps between 0 and 10000),
  result        text        not null default 'compliant'
                            check (result in ('compliant', 'minor_findings', 'major_findings',
                                              'non_compliant')),
  status        text        not null default 'closed'
                            check (status in ('open', 'remediation', 'closed', 'escalated')),
  findings      jsonb       not null default '[]'::jsonb,
  audited_at    timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists labor_compliance_audits_employer_idx on labor_compliance_audits (employer);
create index if not exists labor_compliance_audits_result_idx    on labor_compliance_audits (result);
create index if not exists labor_compliance_audits_status_idx     on labor_compliance_audits (status);

do $$
declare
  t text;
  tables text[] := array['labor_compliance_audits'];
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
