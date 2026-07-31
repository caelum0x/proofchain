-- =============================================================================
-- Compliance — Halal certifications read model. Populated by the @proofchain/api
-- indexer from the HalalCertification contract. Attests product/process
-- conformity to halal standards by an accredited body. Conventions mirror
-- 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists halal_certifications (
  id             text        primary key,
  batch_id       text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  producer       text        not null check (producer ~ '^0x[0-9a-f]{40}$'),
  certifier      text        check (certifier is null or certifier ~ '^0x[0-9a-f]{40}$'),
  standard       text,
  scope          text,
  status         text        not null default 'certified'
                             check (status in ('certified', 'suspended', 'revoked', 'expired')),
  certified_at   timestamptz,
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists halal_certifications_producer_idx  on halal_certifications (producer);
create index if not exists halal_certifications_certifier_idx  on halal_certifications (certifier);
create index if not exists halal_certifications_batch_idx       on halal_certifications (batch_id);
create index if not exists halal_certifications_status_idx       on halal_certifications (status);

do $$
declare
  t text;
  tables text[] := array['halal_certifications'];
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
