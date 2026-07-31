-- =============================================================================
-- Trade finance — Guarantees registry read model. Populated by the
-- @proofchain/api indexer from the GuaranteeRegistry contract. Bank / bid /
-- performance / advance-payment guarantees. Conventions mirror 00_core.sql
-- (hex CHECKs, numeric(78,0) amounts, RLS, idempotent DDL).
-- =============================================================================

create table if not exists guarantees (
  id            text        primary key,
  guarantee_type text       not null default 'performance'
                            check (guarantee_type in ('bid', 'performance', 'advance_payment',
                                                      'warranty', 'payment', 'customs')),
  guarantor     text        not null check (guarantor ~ '^0x[0-9a-f]{40}$'),
  principal     text        not null check (principal ~ '^0x[0-9a-f]{40}$'),
  beneficiary   text        not null check (beneficiary ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount        numeric(78, 0) not null default 0 check (amount >= 0),
  status        text        not null default 'issued'
                            check (status in ('issued', 'active', 'called', 'released',
                                              'expired', 'cancelled')),
  expiry_date   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists guarantees_guarantor_idx    on guarantees (guarantor);
create index if not exists guarantees_principal_idx     on guarantees (principal);
create index if not exists guarantees_beneficiary_idx    on guarantees (beneficiary);
create index if not exists guarantees_status_idx          on guarantees (status);

do $$
declare
  t text;
  tables text[] := array['guarantees'];
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
