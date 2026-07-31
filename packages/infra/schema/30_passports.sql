-- =============================================================================
-- Digital Product Passport (DPP) — passports read model. Mirrors the on-chain
-- DigitalProductPassport (ERC721): one row per tokenId with lifecycle status.
-- Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `token_id` is a uint256 serialized as a base-10 string (numeric(78,0)).
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists passports (
  token_id      text        primary key,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  product_name  text,
  status        text        not null default 'draft'
                            check (status in ('draft', 'issued', 'active', 'recycled', 'retired')),
  data_uri      text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists passports_batch_idx  on passports (batch_id);
create index if not exists passports_owner_idx    on passports (owner);
create index if not exists passports_status_idx    on passports (status);

drop trigger if exists passports_set_updated_at on passports;
create trigger passports_set_updated_at
  before update on passports
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['passports'];
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
