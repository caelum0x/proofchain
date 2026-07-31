-- =============================================================================
-- Energy/ESG — Renewable Energy Certificates (REC) read model. Populated by the
-- @proofchain/api indexer from the RenewableEnergyCertificate (ERC1155) contract.
-- Each row is a REC batch representing MWh of renewable generation. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) volumes, RLS, idempotent DDL).
-- =============================================================================

create table if not exists renewable_certificates (
  id            text        primary key,
  token_id      text,
  issuer        text        not null check (issuer ~ '^0x[0-9a-f]{40}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  energy_source text        not null default 'solar'
                            check (energy_source in ('solar', 'wind', 'hydro', 'geothermal',
                                                     'biomass', 'tidal', 'nuclear')),
  mwh           numeric(78, 0) not null default 0 check (mwh >= 0),
  facility      text,
  vintage_year  integer     check (vintage_year is null or vintage_year between 1990 and 2100),
  status        text        not null default 'issued'
                            check (status in ('issued', 'transferred', 'retired', 'cancelled')),
  retired_at    timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists renewable_certificates_issuer_idx on renewable_certificates (issuer);
create index if not exists renewable_certificates_owner_idx   on renewable_certificates (owner);
create index if not exists renewable_certificates_source_idx   on renewable_certificates (energy_source);
create index if not exists renewable_certificates_status_idx    on renewable_certificates (status);

do $$
declare
  t text;
  tables text[] := array['renewable_certificates'];
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
