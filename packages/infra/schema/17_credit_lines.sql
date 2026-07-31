-- =============================================================================
-- Trade finance — Credit lines read model. Populated by the @proofchain/api
-- indexer from the CreditLineManager contract. Revolving credit facilities with
-- draw/repay accounting. Conventions mirror 00_core.sql (hex CHECKs,
-- numeric(78,0) amounts, bps rates, RLS, idempotent DDL).
-- =============================================================================

create table if not exists credit_lines (
  id            text        primary key,
  borrower      text        not null check (borrower ~ '^0x[0-9a-f]{40}$'),
  lender        text        check (lender is null or lender ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  credit_limit  numeric(78, 0) not null default 0 check (credit_limit >= 0),
  drawn         numeric(78, 0) not null default 0 check (drawn >= 0),
  rate_bps      integer     not null default 0 check (rate_bps between 0 and 10000),
  status        text        not null default 'open'
                            check (status in ('open', 'drawn', 'frozen', 'repaid',
                                              'defaulted', 'closed')),
  expiry_date   timestamptz,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists credit_lines_borrower_idx on credit_lines (borrower);
create index if not exists credit_lines_lender_idx    on credit_lines (lender);
create index if not exists credit_lines_status_idx     on credit_lines (status);

do $$
declare
  t text;
  tables text[] := array['credit_lines'];
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
