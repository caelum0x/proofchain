-- =============================================================================
-- Workforce — Worker credentials read model. Populated by the @proofchain/api
-- indexer from the WorkerCredential (soulbound ERC721) contract. Non-transferable
-- identity/qualification credentials bound to a worker address. Conventions
-- mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists worker_credentials (
  id              text        primary key,
  token_id        text,
  worker          text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  issuer          text        check (issuer is null or issuer ~ '^0x[0-9a-f]{40}$'),
  credential_type text        not null default 'identity'
                             check (credential_type in ('identity', 'license', 'certification',
                                                        'membership', 'clearance')),
  title           text,
  status          text        not null default 'active'
                             check (status in ('active', 'suspended', 'revoked', 'expired')),
  issued_at       timestamptz,
  expiry_date     timestamptz,
  uri             text,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists worker_credentials_worker_idx on worker_credentials (worker);
create index if not exists worker_credentials_issuer_idx  on worker_credentials (issuer);
create index if not exists worker_credentials_type_idx     on worker_credentials (credential_type);
create index if not exists worker_credentials_status_idx    on worker_credentials (status);

do $$
declare
  t text;
  tables text[] := array['worker_credentials'];
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
