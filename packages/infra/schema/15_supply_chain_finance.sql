-- =============================================================================
-- Trade finance — Supply-chain finance (reverse factoring) programs read model.
-- Populated by the @proofchain/api indexer from the SupplyChainFinance contract.
-- Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists scf_programs (
  id             text        primary key,
  anchor_buyer   text        not null check (anchor_buyer ~ '^0x[0-9a-f]{40}$'),
  funder         text        check (funder is null or funder ~ '^0x[0-9a-f]{40}$'),
  token          text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  credit_limit   numeric(78, 0) not null default 0 check (credit_limit >= 0),
  utilized       numeric(78, 0) not null default 0 check (utilized >= 0),
  rate_bps       integer     not null default 0 check (rate_bps between 0 and 10000),
  status         text        not null default 'active'
                             check (status in ('active', 'suspended', 'closed')),
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists scf_programs_anchor_idx on scf_programs (anchor_buyer);
create index if not exists scf_programs_funder_idx  on scf_programs (funder);
create index if not exists scf_programs_status_idx   on scf_programs (status);

create table if not exists scf_positions (
  id            text        primary key,
  program_id    text        not null references scf_programs (id) on delete cascade,
  supplier      text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  invoice_id    text        check (invoice_id is null or invoice_id ~ '^0x[0-9a-f]{64}$'),
  amount        numeric(78, 0) not null default 0 check (amount >= 0),
  status        text        not null default 'financed'
                            check (status in ('financed', 'repaid', 'overdue', 'written_off')),
  due_date      timestamptz,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists scf_positions_program_idx  on scf_positions (program_id);
create index if not exists scf_positions_supplier_idx  on scf_positions (supplier);
create index if not exists scf_positions_status_idx     on scf_positions (status);

do $$
declare
  t text;
  tables text[] := array['scf_programs', 'scf_positions'];
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
