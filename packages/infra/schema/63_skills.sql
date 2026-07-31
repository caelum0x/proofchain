-- =============================================================================
-- Workforce — Skill attestations read model. Populated by the @proofchain/api
-- indexer from the SkillAttestation contract. Peer/employer attestations of a
-- worker's competencies at a proficiency level. Conventions mirror 00_core.sql
-- (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists skill_attestations (
  id            text        primary key,
  worker        text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  attestor      text        not null check (attestor ~ '^0x[0-9a-f]{40}$'),
  skill         text        not null,
  level         text        not null default 'intermediate'
                            check (level in ('novice', 'beginner', 'intermediate',
                                             'advanced', 'expert')),
  weight        integer     not null default 1 check (weight >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'revoked', 'disputed')),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists skill_attestations_worker_idx   on skill_attestations (worker);
create index if not exists skill_attestations_attestor_idx  on skill_attestations (attestor);
create index if not exists skill_attestations_skill_idx      on skill_attestations (skill);

do $$
declare
  t text;
  tables text[] := array['skill_attestations'];
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
