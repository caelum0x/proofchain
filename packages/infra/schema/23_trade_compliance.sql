-- =============================================================================
-- Compliance — Trade compliance engine read model. Populated by the
-- @proofchain/api indexer from the TradeComplianceEngine contract. Rule
-- evaluations gating a shipment/deal (dual-use, embargo, HS-code checks).
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists trade_compliance_checks (
  id            text        primary key,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  deal_id       text        check (deal_id is null or deal_id ~ '^0x[0-9a-f]{64}$'),
  subject       text        check (subject is null or subject ~ '^0x[0-9a-f]{40}$'),
  hs_code       text,
  origin_country text,
  dest_country   text,
  ruleset       text,
  result        text        not null default 'pending'
                            check (result in ('pending', 'passed', 'failed', 'manual_review')),
  reason        text,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists trade_compliance_checks_batch_idx  on trade_compliance_checks (batch_id);
create index if not exists trade_compliance_checks_deal_idx    on trade_compliance_checks (deal_id);
create index if not exists trade_compliance_checks_result_idx   on trade_compliance_checks (result);

do $$
declare
  t text;
  tables text[] := array['trade_compliance_checks'];
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
