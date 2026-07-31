-- =============================================================================
-- Energy/ESG — Green bond issuance read model. Populated by the @proofchain/api
-- indexer from the GreenBondIssuer contract. Use-of-proceeds bonds funding
-- certified green projects, with coupon/maturity terms. Conventions mirror
-- 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps coupon, RLS, idempotent).
-- =============================================================================

create table if not exists green_bonds (
  id            text        primary key,
  isin          text,
  issuer        text        not null check (issuer ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  face_value    numeric(78, 0) not null default 0 check (face_value >= 0),
  outstanding   numeric(78, 0) not null default 0 check (outstanding >= 0),
  coupon_bps    integer     not null default 0 check (coupon_bps between 0 and 10000),
  currency      text,
  use_of_proceeds text,
  framework     text,
  status        text        not null default 'issued'
                            check (status in ('announced', 'issued', 'servicing',
                                              'matured', 'defaulted', 'redeemed')),
  issue_date    timestamptz,
  maturity_date timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists green_bonds_issuer_idx on green_bonds (issuer);
create index if not exists green_bonds_status_idx  on green_bonds (status);
create index if not exists green_bonds_maturity_idx on green_bonds (maturity_date);

do $$
declare
  t text;
  tables text[] := array['green_bonds'];
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
