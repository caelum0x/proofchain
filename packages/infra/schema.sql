-- ProofChain — Supabase schema
-- =============================================================================
-- Tables:
--   jobs      — verification jobs submitted to the agent + their status.
--   verdicts  — cached AI verdicts (one row per batch, mirrors on-chain attestation).
--   deals     — mirror of on-chain SettlementEscrow deals for fast dashboard queries.
--
-- Design notes
--   * All on-chain identifiers (batch ids, addresses, tx hashes, hashes) are stored
--     as lowercase hex `text` with an explicit format CHECK so bad data fails fast at
--     the DB boundary — never trust the caller.
--   * `score`/`threshold` are basis points (0..10000). CHECK constraints enforce the
--     range exactly as the contracts do (uint16 bps).
--   * `updated_at` is maintained by a trigger so read models can't drift.
--   * This schema is idempotent (IF NOT EXISTS / OR REPLACE) so it is safe to re-run
--     during deploys / migrations.
--
-- Apply with:
--   psql "$SUPABASE_DB_URL" -f schema.sql
--   -- or paste into the Supabase SQL editor.
-- =============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- Enums ----------------------------------------------------------------------
-- Job lifecycle. `queued` on insert, terminal states are `succeeded`/`failed`.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('queued', 'running', 'succeeded', 'failed');
  end if;
end
$$;

-- Deal lifecycle. Mirrors SettlementEscrow.DealState (None is never persisted).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'deal_state') then
    create type deal_state as enum ('funded', 'released', 'refunded', 'disputed');
  end if;
end
$$;

-- Shared updated_at trigger ---------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- jobs
-- =============================================================================
create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  batch_id      text        not null check (batch_id ~ '^0x[0-9a-f]{64}$'),
  status        job_status  not null default 'queued',
  -- Original request payload (documents metadata, etc). Kept as jsonb for flexibility.
  request       jsonb       not null default '{}'::jsonb,
  -- Final verdict payload (VerificationVerdict) once the job succeeds; null otherwise.
  result        jsonb,
  -- Structured error envelope { code, message, details? } when the job fails.
  error         jsonb,
  -- On-chain attestation tx hash, once submitted.
  tx_hash       text        check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists jobs_batch_id_idx   on jobs (batch_id);
create index if not exists jobs_status_idx      on jobs (status);
create index if not exists jobs_created_at_idx   on jobs (created_at desc);

drop trigger if exists jobs_set_updated_at on jobs;
create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- =============================================================================
-- verdicts (one attestation per batch — matches AttestationRegistry immutability)
-- =============================================================================
create table if not exists verdicts (
  batch_id        text        primary key check (batch_id ~ '^0x[0-9a-f]{64}$'),
  score           integer     not null check (score between 0 and 10000),
  passed          boolean     not null,
  threshold       integer     not null check (threshold between 0 and 10000),
  findings        jsonb       not null default '[]'::jsonb,
  document_hashes jsonb       not null default '[]'::jsonb,
  verdict_hash    text        not null check (verdict_hash ~ '^0x[0-9a-f]{64}$'),
  verdict_uri     text,
  model           text        not null,
  created_at      timestamptz not null default now()
);

create index if not exists verdicts_passed_idx      on verdicts (passed);
create index if not exists verdicts_created_at_idx   on verdicts (created_at desc);

-- =============================================================================
-- deals (read model mirror of SettlementEscrow)
-- =============================================================================
create table if not exists deals (
  batch_id    text        primary key check (batch_id ~ '^0x[0-9a-f]{64}$'),
  buyer       text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  supplier    text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  token       text        not null check (token ~ '^0x[0-9a-f]{40}$'),
  -- ERC20 amounts can exceed bigint; store as numeric(78,0) (fits uint256).
  amount      numeric(78, 0) not null check (amount >= 0),
  state       deal_state  not null,
  tx_hash     text        check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists deals_buyer_idx        on deals (buyer);
create index if not exists deals_supplier_idx      on deals (supplier);
create index if not exists deals_state_idx         on deals (state);
create index if not exists deals_updated_at_idx     on deals (updated_at desc);

drop trigger if exists deals_set_updated_at on deals;
create trigger deals_set_updated_at
  before update on deals
  for each row execute function set_updated_at();

-- =============================================================================
-- Row Level Security (RLS) — documented policy
-- =============================================================================
-- ProofChain writes to these tables exclusively from trusted server-side code
-- (the agent service and infra scripts) using the SUPABASE_SERVICE_ROLE_KEY. The
-- service role BYPASSES RLS, so the policies below only govern any browser / anon
-- (public) access made with the anon key.
--
-- Posture:
--   * Enable RLS on every table (deny-by-default).
--   * Grant the public/anon role READ-ONLY access, since dashboards surface
--     provenance, verdicts and settlement status publicly. No PII is stored.
--   * Grant NO insert/update/delete to anon — all writes go through the service
--     role on the server, which is never exposed to the browser.
--
-- If you later need per-user scoping (e.g. suppliers only seeing their own deals),
-- replace the "read all" policies with policies that compare a wallet/user claim
-- from the JWT (e.g. `auth.jwt() ->> 'wallet'`) against buyer/supplier columns.

alter table jobs     enable row level security;
alter table verdicts enable row level security;
alter table deals    enable row level security;

-- Public read-only policies (anon + authenticated). Service role bypasses these.
drop policy if exists jobs_read_all on jobs;
create policy jobs_read_all
  on jobs for select
  to anon, authenticated
  using (true);

drop policy if exists verdicts_read_all on verdicts;
create policy verdicts_read_all
  on verdicts for select
  to anon, authenticated
  using (true);

drop policy if exists deals_read_all on deals;
create policy deals_read_all
  on deals for select
  to anon, authenticated
  using (true);

-- No write policies are defined for anon/authenticated: writes are denied for
-- everyone except the service role (which bypasses RLS entirely).
