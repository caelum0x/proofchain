-- =============================================================================
-- Compliance — Product recall registry read model. Populated by the
-- @proofchain/api indexer from the ProductRecallRegistry contract. Tracks recall
-- notices against provenance batches/products with severity and remediation.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists product_recalls (
  id            text        primary key,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  initiator     text        not null check (initiator ~ '^0x[0-9a-f]{40}$'),
  severity      text        not null default 'medium'
                            check (severity in ('low', 'medium', 'high', 'critical')),
  reason        text,
  affected_units numeric(78, 0) not null default 0 check (affected_units >= 0),
  status        text        not null default 'open'
                            check (status in ('open', 'in_progress', 'resolved', 'withdrawn')),
  resolved_at   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists product_recalls_batch_idx     on product_recalls (batch_id);
create index if not exists product_recalls_initiator_idx  on product_recalls (initiator);
create index if not exists product_recalls_severity_idx    on product_recalls (severity);
create index if not exists product_recalls_status_idx       on product_recalls (status);

do $$
declare
  t text;
  tables text[] := array['product_recalls'];
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
