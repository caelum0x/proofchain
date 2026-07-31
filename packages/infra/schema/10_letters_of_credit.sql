-- =============================================================================
-- Trade finance — Letters of Credit read model. Populated by the @proofchain/api
-- indexer from the LetterOfCredit contract. Conventions mirror 00_core.sql:
--   * On-chain identifiers as lowercase hex `text` with a format CHECK.
--   * uint256 amounts as numeric(78,0); `updated_at` via set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists letters_of_credit (
  id            text        primary key,
  lc_number     text,
  applicant     text        not null check (applicant ~ '^0x[0-9a-f]{40}$'),
  beneficiary   text        not null check (beneficiary ~ '^0x[0-9a-f]{40}$'),
  issuing_bank  text        check (issuing_bank is null or issuing_bank ~ '^0x[0-9a-f]{40}$'),
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount        numeric(78, 0) not null default 0 check (amount >= 0),
  currency      text,
  incoterm      text,
  status        text        not null default 'issued'
                            check (status in ('draft', 'issued', 'confirmed', 'presented',
                                              'accepted', 'paid', 'expired', 'cancelled')),
  expiry_date   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists letters_of_credit_applicant_idx   on letters_of_credit (applicant);
create index if not exists letters_of_credit_beneficiary_idx  on letters_of_credit (beneficiary);
create index if not exists letters_of_credit_status_idx        on letters_of_credit (status);
create index if not exists letters_of_credit_batch_idx          on letters_of_credit (batch_id);

do $$
declare
  t text;
  tables text[] := array['letters_of_credit'];
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
