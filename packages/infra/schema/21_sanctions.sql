-- =============================================================================
-- Compliance — Sanctions screening read model. Populated by the @proofchain/api
-- indexer from the SanctionsScreening contract. One row per screening event of a
-- counterparty against a sanctions list (OFAC/EU/UN). Conventions mirror
-- 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists sanctions_screenings (
  id            text        primary key,
  subject       text        not null check (subject ~ '^0x[0-9a-f]{40}$'),
  list_source   text        not null default 'ofac'
                            check (list_source in ('ofac', 'eu', 'un', 'uk', 'internal')),
  result        text        not null default 'clear'
                            check (result in ('clear', 'match', 'potential_match', 'blocked')),
  match_score   integer     not null default 0 check (match_score between 0 and 10000),
  screened_by   text        check (screened_by is null or screened_by ~ '^0x[0-9a-f]{40}$'),
  reference     text,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sanctions_screenings_subject_idx on sanctions_screenings (subject);
create index if not exists sanctions_screenings_result_idx   on sanctions_screenings (result);
create index if not exists sanctions_screenings_source_idx    on sanctions_screenings (list_source);

do $$
declare
  t text;
  tables text[] := array['sanctions_screenings'];
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
