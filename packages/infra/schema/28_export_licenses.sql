-- =============================================================================
-- Compliance — Export license registry read model. Populated by the
-- @proofchain/api indexer from the ExportLicenseRegistry contract. Government
-- authorizations to export controlled/dual-use goods to a destination.
-- Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) quota, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists export_licenses (
  id             text        primary key,
  license_number text,
  holder         text        not null check (holder ~ '^0x[0-9a-f]{40}$'),
  authority      text        check (authority is null or authority ~ '^0x[0-9a-f]{40}$'),
  hs_code        text,
  dest_country   text,
  quota          numeric(78, 0) not null default 0 check (quota >= 0),
  used           numeric(78, 0) not null default 0 check (used >= 0),
  status         text        not null default 'active'
                             check (status in ('pending', 'active', 'suspended',
                                               'revoked', 'expired', 'exhausted')),
  issued_at      timestamptz,
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists export_licenses_holder_idx   on export_licenses (holder);
create index if not exists export_licenses_status_idx    on export_licenses (status);
create index if not exists export_licenses_dest_idx       on export_licenses (dest_country);

do $$
declare
  t text;
  tables text[] := array['export_licenses'];
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
