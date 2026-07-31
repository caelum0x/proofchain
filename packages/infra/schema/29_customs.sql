-- =============================================================================
-- Compliance — Customs declarations + duty/tariff assessments read model.
-- Populated by the @proofchain/api indexer from the CustomsDeclaration and
-- DutyAndTariffCalculator contracts. Conventions mirror 00_core.sql (hex CHECKs,
-- numeric(78,0) amounts, bps rates, RLS, idempotent DDL).
-- =============================================================================

create table if not exists customs_declarations (
  id             text        primary key,
  batch_id       text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  declarant      text        not null check (declarant ~ '^0x[0-9a-f]{40}$'),
  broker         text        check (broker is null or broker ~ '^0x[0-9a-f]{40}$'),
  direction      text        not null default 'import'
                             check (direction in ('import', 'export', 'transit')),
  hs_code        text,
  origin_country text,
  dest_country   text,
  declared_value numeric(78, 0) not null default 0 check (declared_value >= 0),
  currency       text,
  status         text        not null default 'lodged'
                             check (status in ('draft', 'lodged', 'accepted', 'inspected',
                                               'cleared', 'held', 'rejected')),
  cleared_at     timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists customs_declarations_declarant_idx on customs_declarations (declarant);
create index if not exists customs_declarations_batch_idx      on customs_declarations (batch_id);
create index if not exists customs_declarations_status_idx      on customs_declarations (status);

create table if not exists duty_assessments (
  id             text        primary key,
  declaration_id text        references customs_declarations (id) on delete cascade,
  hs_code        text,
  duty_type      text        not null default 'ad_valorem'
                             check (duty_type in ('ad_valorem', 'specific', 'compound',
                                                  'anti_dumping', 'excise', 'vat')),
  rate_bps       integer     not null default 0 check (rate_bps between 0 and 10000),
  taxable_value  numeric(78, 0) not null default 0 check (taxable_value >= 0),
  duty_amount    numeric(78, 0) not null default 0 check (duty_amount >= 0),
  currency       text,
  status         text        not null default 'assessed'
                             check (status in ('assessed', 'paid', 'waived', 'disputed')),
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists duty_assessments_declaration_idx on duty_assessments (declaration_id);
create index if not exists duty_assessments_status_idx       on duty_assessments (status);

do $$
declare
  t text;
  tables text[] := array['customs_declarations', 'duty_assessments'];
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
