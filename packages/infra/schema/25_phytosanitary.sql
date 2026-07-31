-- =============================================================================
-- Compliance — Phytosanitary certificates read model. Populated by the
-- @proofchain/api indexer from the PhytosanitaryCertificate contract. Attests
-- that plant/agri consignments meet importing-country plant-health requirements.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists phytosanitary_certs (
  id             text        primary key,
  batch_id       text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  exporter       text        not null check (exporter ~ '^0x[0-9a-f]{40}$'),
  inspector      text        check (inspector is null or inspector ~ '^0x[0-9a-f]{40}$'),
  origin_country text        not null,
  dest_country   text,
  commodity      text,
  treatment      text,
  result         text        not null default 'passed'
                             check (result in ('passed', 'failed', 'conditional')),
  status         text        not null default 'issued'
                             check (status in ('issued', 'verified', 'revoked', 'expired')),
  inspected_at   timestamptz,
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists phytosanitary_certs_exporter_idx on phytosanitary_certs (exporter);
create index if not exists phytosanitary_certs_batch_idx     on phytosanitary_certs (batch_id);
create index if not exists phytosanitary_certs_status_idx     on phytosanitary_certs (status);

do $$
declare
  t text;
  tables text[] := array['phytosanitary_certs'];
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
