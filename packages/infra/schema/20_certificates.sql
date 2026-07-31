-- =============================================================================
-- Compliance — certificates read model (certificate of origin, phytosanitary,
-- halal, and other trade certificates). Populated by the @proofchain/api indexer
-- from the compliance contracts. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists certificates (
  id          text        primary key,
  kind        text        not null,
  batch_id    text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  holder      text        check (holder is null or holder ~ '^0x[0-9a-f]{40}$'),
  issuer      text        check (issuer is null or issuer ~ '^0x[0-9a-f]{40}$'),
  status      text        not null default 'valid'
                          check (status in ('valid', 'revoked', 'expired')),
  uri         text,
  expires_at  timestamptz,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists certificates_kind_idx    on certificates (kind);
create index if not exists certificates_batch_idx     on certificates (batch_id);
create index if not exists certificates_holder_idx     on certificates (holder);
create index if not exists certificates_status_idx      on certificates (status);

drop trigger if exists certificates_set_updated_at on certificates;
create trigger certificates_set_updated_at
  before update on certificates
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['certificates'];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_read_all on %I', t, t);
    execute format(
      'create policy %I_read_all on %I for select to anon, authenticated using (true)',
      t, t
    );
  end loop;
end
$$;
