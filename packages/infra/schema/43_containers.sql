-- =============================================================================
-- Logistics — containers read model. Populated by the @proofchain/api indexer
-- from the ContainerRegistry contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists containers (
  id                text        primary key,
  container_number  text,
  freight_id        text        references freight (id) on delete set null,
  batch_id          text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  status            text        not null default 'empty'
                                check (status in ('empty', 'loaded', 'sealed', 'in_transit', 'delivered')),
  location          text,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists containers_number_idx    on containers (container_number);
create index if not exists containers_freight_idx     on containers (freight_id);
create index if not exists containers_batch_idx        on containers (batch_id);
create index if not exists containers_status_idx        on containers (status);

drop trigger if exists containers_set_updated_at on containers;
create trigger containers_set_updated_at
  before update on containers
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['containers'];
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
