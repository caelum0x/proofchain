-- =============================================================================
-- Compliance — Certificates of origin read model. Populated by the
-- @proofchain/api indexer from the CertificateOfOrigin contract. Declares the
-- economic origin of goods for preferential/non-preferential tariff treatment.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists certificates_of_origin (
  id             text        primary key,
  batch_id       text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  exporter       text        not null check (exporter ~ '^0x[0-9a-f]{40}$'),
  importer       text        check (importer is null or importer ~ '^0x[0-9a-f]{40}$'),
  issuer         text        check (issuer is null or issuer ~ '^0x[0-9a-f]{40}$'),
  origin_country text        not null,
  dest_country   text,
  hs_code        text,
  preferential   boolean     not null default false,
  status         text        not null default 'issued'
                             check (status in ('issued', 'verified', 'revoked', 'expired')),
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists certificates_of_origin_exporter_idx on certificates_of_origin (exporter);
create index if not exists certificates_of_origin_batch_idx     on certificates_of_origin (batch_id);
create index if not exists certificates_of_origin_status_idx     on certificates_of_origin (status);
create index if not exists certificates_of_origin_country_idx     on certificates_of_origin (origin_country);

do $$
declare
  t text;
  tables text[] := array['certificates_of_origin'];
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
