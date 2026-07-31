-- =============================================================================
-- DPP — Repairability index read model. Populated by the @proofchain/api indexer
-- from the RepairabilityIndex contract. Scores a product's ease of repair
-- (spare-part availability, documentation, disassembly). Conventions mirror
-- 00_core.sql (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists repairability_scores (
  id               text        primary key,
  token_id         text        not null,
  passport_id      text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  assessor         text        check (assessor is null or assessor ~ '^0x[0-9a-f]{40}$'),
  overall_bps      integer     not null default 0 check (overall_bps between 0 and 10000),
  parts_bps        integer     not null default 0 check (parts_bps between 0 and 10000),
  docs_bps         integer     not null default 0 check (docs_bps between 0 and 10000),
  disassembly_bps  integer     not null default 0 check (disassembly_bps between 0 and 10000),
  grade            text,
  uri              text,
  metadata         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists repairability_scores_token_idx on repairability_scores (token_id);
create index if not exists repairability_scores_grade_idx  on repairability_scores (grade);

do $$
declare
  t text;
  tables text[] := array['repairability_scores'];
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
