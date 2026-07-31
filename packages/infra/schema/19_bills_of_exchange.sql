-- =============================================================================
-- Trade finance — Bills of exchange read model. Populated by the @proofchain/api
-- indexer from the BillOfExchange contract. Negotiable drafts with drawer /
-- drawee / payee and acceptance lifecycle. Conventions mirror 00_core.sql
-- (hex CHECKs, numeric(78,0) amounts, RLS, idempotent DDL).
-- =============================================================================

create table if not exists bills_of_exchange (
  id            text        primary key,
  drawer        text        not null check (drawer ~ '^0x[0-9a-f]{40}$'),
  drawee        text        not null check (drawee ~ '^0x[0-9a-f]{40}$'),
  payee         text        check (payee is null or payee ~ '^0x[0-9a-f]{40}$'),
  holder        text        check (holder is null or holder ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount        numeric(78, 0) not null default 0 check (amount >= 0),
  status        text        not null default 'drawn'
                            check (status in ('drawn', 'accepted', 'endorsed', 'discounted',
                                              'paid', 'dishonoured', 'cancelled')),
  maturity_date timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists bills_of_exchange_drawer_idx on bills_of_exchange (drawer);
create index if not exists bills_of_exchange_drawee_idx  on bills_of_exchange (drawee);
create index if not exists bills_of_exchange_holder_idx   on bills_of_exchange (holder);
create index if not exists bills_of_exchange_status_idx    on bills_of_exchange (status);

do $$
declare
  t text;
  tables text[] := array['bills_of_exchange'];
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
