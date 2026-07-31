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


-- #############################################################################
-- SPEC2 — Platform expansion read models
-- =============================================================================
-- Read-model tables populated by the @proofchain/api indexer from on-chain
-- events, plus the indexer's own bookkeeping. Design rules mirror the core
-- tables above:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * uint256 amounts as numeric(78,0) (fits the full range).
--   * Basis-point scores CHECK-constrained to 0..10000.
--   * `updated_at` maintained by the shared trigger; everything idempotent.
--   * Status fields are `text` with CHECKs (not enums) so the indexer can evolve
--     lifecycle values without a type migration.
-- #############################################################################

-- --- Indexer bookkeeping -----------------------------------------------------
-- Append-only decoded event log. `id` = '<txHash>:<logIndex>' so re-processing a
-- block range on restart is idempotent (upsert on the natural key).
create table if not exists indexer_events (
  id           text        primary key,
  group_name   text        not null,
  contract     text        not null,
  address      text        not null check (address ~ '^0x[0-9a-f]{40}$'),
  event_name   text        not null,
  args         jsonb       not null default '{}'::jsonb,
  block_number numeric(78, 0) not null check (block_number >= 0),
  tx_hash      text        not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index    integer     not null check (log_index >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists indexer_events_group_idx    on indexer_events (group_name);
create index if not exists indexer_events_contract_idx on indexer_events (contract);
create index if not exists indexer_events_block_idx     on indexer_events (block_number);
create index if not exists indexer_events_created_idx    on indexer_events (created_at desc);

-- Per-contract cursor: the last fully-processed block.
create table if not exists indexer_cursors (
  key         text        primary key,
  last_block  numeric(78, 0) not null check (last_block >= 0),
  updated_at  timestamptz not null default now()
);

-- --- M3 identity -------------------------------------------------------------
create table if not exists organizations (
  id          text        primary key,
  name        text        not null,
  org_type    text,
  admin       text        check (admin is null or admin ~ '^0x[0-9a-f]{40}$'),
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists suppliers (
  address     text        primary key check (address ~ '^0x[0-9a-f]{40}$'),
  name        text,
  uri         text,
  org_id      text        references organizations (id) on delete set null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists suppliers_org_idx on suppliers (org_id);

create table if not exists buyers (
  address     text        primary key check (address ~ '^0x[0-9a-f]{40}$'),
  name        text,
  uri         text,
  org_id      text        references organizations (id) on delete set null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists buyers_org_idx on buyers (org_id);

create table if not exists carriers (
  address     text        primary key check (address ~ '^0x[0-9a-f]{40}$'),
  name        text,
  uri         text,
  org_id      text        references organizations (id) on delete set null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists kyc (
  address     text        primary key check (address ~ '^0x[0-9a-f]{40}$'),
  level       smallint    not null default 0 check (level >= 0),
  provider    text        check (provider is null or provider ~ '^0x[0-9a-f]{40}$'),
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- M4 reputation & bonds ---------------------------------------------------
create table if not exists reputation (
  supplier      text        primary key check (supplier ~ '^0x[0-9a-f]{40}$'),
  avg_score_bps integer     not null default 0 check (avg_score_bps between 0 and 10000),
  total_deals   integer     not null default 0 check (total_deals >= 0),
  pass_rate_bps integer     not null default 0 check (pass_rate_bps between 0 and 10000),
  disputes      integer     not null default 0 check (disputes >= 0),
  grade         smallint    check (grade is null or grade >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reputation_grade_idx on reputation (grade);

create table if not exists bonds (
  supplier    text        primary key check (supplier ~ '^0x[0-9a-f]{40}$'),
  token       text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount      numeric(78, 0) not null default 0 check (amount >= 0),
  locked      numeric(78, 0) not null default 0 check (locked >= 0),
  status      text        not null default 'active' check (status in ('active', 'withdrawn', 'slashed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- M5 finance / RWA --------------------------------------------------------
create table if not exists receivables (
  batch_id    text        primary key check (batch_id ~ '^0x[0-9a-f]{64}$'),
  token_id    numeric(78, 0) check (token_id is null or token_id >= 0),
  obligor     text        check (obligor is null or obligor ~ '^0x[0-9a-f]{40}$'),
  holder      text        check (holder is null or holder ~ '^0x[0-9a-f]{40}$'),
  face_value  numeric(78, 0) check (face_value is null or face_value >= 0),
  due         timestamptz,
  status      text        not null default 'registered',
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists receivables_holder_idx on receivables (holder);

create table if not exists financing_listings (
  batch_id       text        primary key check (batch_id ~ '^0x[0-9a-f]{64}$'),
  supplier       text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  lender         text        check (lender is null or lender ~ '^0x[0-9a-f]{40}$'),
  ask_amount     numeric(78, 0) not null default 0 check (ask_amount >= 0),
  advance_amount numeric(78, 0) check (advance_amount is null or advance_amount >= 0),
  status         text        not null default 'listed'
                             check (status in ('listed', 'funded', 'claimed', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists financing_listings_status_idx   on financing_listings (status);
create index if not exists financing_listings_supplier_idx  on financing_listings (supplier);

create table if not exists pools (
  id           text        primary key,
  manager      text        check (manager is null or manager ~ '^0x[0-9a-f]{40}$'),
  total_assets numeric(78, 0) not null default 0 check (total_assets >= 0),
  total_shares numeric(78, 0) not null default 0 check (total_shares >= 0),
  risk_grade   smallint    check (risk_grade is null or risk_grade >= 0),
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --- M6 insurance ------------------------------------------------------------
create table if not exists policies (
  id          text        primary key,
  batch_id    text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  holder      text        check (holder is null or holder ~ '^0x[0-9a-f]{40}$'),
  coverage    numeric(78, 0) not null default 0 check (coverage >= 0),
  premium     numeric(78, 0) not null default 0 check (premium >= 0),
  status      text        not null default 'active'
                          check (status in ('active', 'expired', 'claimed', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists policies_batch_idx  on policies (batch_id);
create index if not exists policies_holder_idx  on policies (holder);

create table if not exists claims (
  id          text        primary key,
  policy_id   text        references policies (id) on delete set null,
  batch_id    text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  claimant    text        check (claimant is null or claimant ~ '^0x[0-9a-f]{40}$'),
  amount      numeric(78, 0) not null default 0 check (amount >= 0),
  status      text        not null default 'filed'
                          check (status in ('filed', 'approved', 'paid', 'rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists claims_policy_idx on claims (policy_id);
create index if not exists claims_status_idx  on claims (status);

-- --- M7 disputes & governance ------------------------------------------------
create table if not exists disputes (
  batch_id      text        primary key check (batch_id ~ '^0x[0-9a-f]{64}$'),
  opener        text        check (opener is null or opener ~ '^0x[0-9a-f]{40}$'),
  status        text        not null default 'open' check (status in ('open', 'resolved')),
  refund_buyer  boolean,
  votes_for     integer     not null default 0 check (votes_for >= 0),
  votes_against integer     not null default 0 check (votes_against >= 0),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists disputes_status_idx on disputes (status);

create table if not exists proposals (
  id              text        primary key,
  proposer        text        check (proposer is null or proposer ~ '^0x[0-9a-f]{40}$'),
  description_uri text,
  state           text        not null default 'pending',
  for_votes       numeric(78, 0) not null default 0 check (for_votes >= 0),
  against_votes   numeric(78, 0) not null default 0 check (against_votes >= 0),
  abstain_votes   numeric(78, 0) not null default 0 check (abstain_votes >= 0),
  start_block     numeric(78, 0) check (start_block is null or start_block >= 0),
  end_block       numeric(78, 0) check (end_block is null or end_block >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists proposals_state_idx on proposals (state);

-- Votes are append-only; id = '<proposalId>:<voter>' so a re-index is idempotent.
create table if not exists votes (
  id          text        primary key,
  proposal_id text        not null references proposals (id) on delete cascade,
  voter       text        not null check (voter ~ '^0x[0-9a-f]{40}$'),
  support     smallint    not null check (support in (0, 1, 2)),
  weight      numeric(78, 0) not null default 0 check (weight >= 0),
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists votes_proposal_idx on votes (proposal_id);
create index if not exists votes_voter_idx     on votes (voter);

-- --- M9 marketplace ----------------------------------------------------------
create table if not exists listings (
  id          text        primary key,
  kind        text,
  asset       text,
  seller      text        check (seller is null or seller ~ '^0x[0-9a-f]{40}$'),
  price       numeric(78, 0) check (price is null or price >= 0),
  status      text        not null default 'active'
                          check (status in ('active', 'cancelled', 'filled')),
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists listings_status_idx on listings (status);
create index if not exists listings_seller_idx  on listings (seller);

create table if not exists auctions (
  id             text        primary key,
  asset          text,
  token_id       numeric(78, 0) check (token_id is null or token_id >= 0),
  seller         text        check (seller is null or seller ~ '^0x[0-9a-f]{40}$'),
  highest_bid    numeric(78, 0) not null default 0 check (highest_bid >= 0),
  highest_bidder text        check (highest_bidder is null or highest_bidder ~ '^0x[0-9a-f]{40}$'),
  end_time       timestamptz,
  status         text        not null default 'active'
                             check (status in ('active', 'settled', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists auctions_status_idx on auctions (status);

-- --- M8 tokenization & ESG ---------------------------------------------------
create table if not exists esg (
  id          text        primary key,
  subject     text        not null,
  score       integer     check (score is null or score between 0 and 10000),
  uri         text,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists esg_subject_idx on esg (subject);

create table if not exists carbon (
  id          text        primary key,
  project_id  text,
  batch_id    text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  co2e        numeric(78, 0) not null default 0 check (co2e >= 0),
  retired     numeric(78, 0) not null default 0 check (retired >= 0),
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists carbon_batch_idx   on carbon (batch_id);
create index if not exists carbon_project_idx  on carbon (project_id);

-- --- M10 rewards -------------------------------------------------------------
create table if not exists rewards (
  id          text        primary key,
  account     text        not null check (account ~ '^0x[0-9a-f]{40}$'),
  program     text        not null default 'default',
  amount      numeric(78, 0) not null default 0 check (amount >= 0),
  claimed     numeric(78, 0) not null default 0 check (claimed >= 0),
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists rewards_account_idx on rewards (account);

-- --- Notifications (app-level, append-only) ----------------------------------
create table if not exists notifications (
  id          uuid        primary key default gen_random_uuid(),
  recipient   text        check (recipient is null or recipient ~ '^0x[0-9a-f]{40}$'),
  kind        text        not null,
  payload     jsonb       not null default '{}'::jsonb,
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on notifications (recipient);
create index if not exists notifications_read_idx        on notifications (read);
create index if not exists notifications_created_idx      on notifications (created_at desc);

-- --- updated_at triggers (for tables that carry updated_at) -------------------
do $$
declare
  t text;
  tables text[] := array[
    'indexer_cursors', 'organizations', 'suppliers', 'buyers', 'carriers', 'kyc',
    'reputation', 'bonds', 'receivables', 'financing_listings', 'pools',
    'policies', 'claims', 'disputes', 'proposals', 'listings', 'auctions',
    'esg', 'carbon', 'rewards'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end
$$;

-- --- RLS: enable + public read-only on every SPEC2 table ---------------------
-- Same posture as the core tables: deny-by-default, public SELECT only, all
-- writes go through the service role (which bypasses RLS). No PII is stored.
do $$
declare
  t text;
  tables text[] := array[
    'indexer_events', 'indexer_cursors', 'organizations', 'suppliers', 'buyers',
    'carriers', 'kyc', 'reputation', 'bonds', 'receivables', 'financing_listings',
    'pools', 'policies', 'claims', 'disputes', 'proposals', 'votes', 'listings',
    'auctions', 'esg', 'carbon', 'rewards', 'notifications'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_read_all on %I', t, t);
    execute format(
      'create policy %I_read_all on %I for select to anon, authenticated using (true)',
      t, t
    );
  end loop;
end
$$;
