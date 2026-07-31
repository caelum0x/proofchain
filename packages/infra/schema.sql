-- ============================================================================
-- ProofChain — composed database schema (GENERATED, do not edit).
-- Source of truth: schema/*.sql modules. Regenerate with:
--   node scripts/compose-schema.mjs   (pnpm run schema:build)
-- Apply with: psql "$SUPABASE_DB_URL" -f schema.sql
-- Modules (56): 00_core.sql, 05_provenance.sql, 10_letters_of_credit.sql, 11_factoring.sql, 12_invoices.sql, 13_po_financing.sql, 14_dynamic_discounting.sql, 15_supply_chain_finance.sql, 16_securitization.sql, 17_credit_lines.sql, 18_guarantees.sql, 19_bills_of_exchange.sql, 20_certificates.sql, 21_sanctions.sql, 22_aml.sql, 23_trade_compliance.sql, 24_origin_certs.sql, 25_phytosanitary.sql, 26_halal.sql, 27_recalls.sql, 28_export_licenses.sql, 29_customs.sql, 30_passports.sql, 31_dpp_lifecycle.sql, 32_materials.sql, 33_repairability.sql, 34_recycling.sql, 35_data_carriers.sql, 42_freight.sql, 43_containers.sql, 44_cold_chain.sql, 45_warehouses.sql, 46_fleet.sql, 47_route_attestations.sql, 48_proof_of_delivery.sql, 50_commodities.sql, 51_harvests.sql, 52_grading.sql, 53_storage_receipts.sql, 54_recs.sql, 55_emissions.sql, 56_water_credits.sql, 57_biodiversity.sql, 58_referrals.sql, 59_green_bonds.sql, 60_worker_credentials.sql, 61_safety_training.sql, 62_payroll.sql, 63_skills.sql, 64_labor_compliance.sql, 72_sensors.sql, 73_inspections.sql, 74_lab_tests.sql, 75_oracles.sql, 76_data_market.sql, 90_infra.sql
-- ============================================================================

-- >>> module: 00_core.sql -------------------------------------------------
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

-- >>> module: 05_provenance.sql -------------------------------------------
-- =============================================================================
-- Provenance read models — batches, checkpoints, attestations.
-- =============================================================================
-- Core provenance tables populated by the @proofchain/api indexer from on-chain
-- events (BatchRegistry, provenance checkpoints, AttestationRegistry). Design
-- rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * uint256 amounts as numeric(78,0); basis-point scores CHECK-constrained 0..10000.
--   * `updated_at` maintained by the shared set_updated_at() trigger (mutable tables).
--   * checkpoints/attestations are append-only (created_at only).
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

-- --- batches (BatchRegistry read model, mutable lifecycle) -------------------
create table if not exists batches (
  batch_id      text        primary key check (batch_id ~ '^0x[0-9a-f]{64}$'),
  supplier      text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  buyer         text        check (buyer is null or buyer ~ '^0x[0-9a-f]{40}$'),
  product       text,
  quantity      numeric(78, 0) not null default 0 check (quantity >= 0),
  unit          text,
  metadata_uri  text,
  content_hash  text        check (content_hash is null or content_hash ~ '^0x[0-9a-f]{64}$'),
  status        text        not null default 'created'
                            check (status in ('created', 'in_transit', 'delivered',
                                              'verified', 'settled', 'disputed')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists batches_supplier_idx   on batches (supplier);
create index if not exists batches_buyer_idx       on batches (buyer);
create index if not exists batches_status_idx       on batches (status);
create index if not exists batches_updated_at_idx    on batches (updated_at desc);

-- --- checkpoints (append-only provenance journey points) ---------------------
-- id = '<batchId>:<sequence>' so re-indexing an event range is idempotent.
create table if not exists checkpoints (
  id            text        primary key,
  batch_id      text        not null check (batch_id ~ '^0x[0-9a-f]{64}$'),
  sequence      integer     not null default 0 check (sequence >= 0),
  kind          text        not null default 'checkpoint',
  actor         text        check (actor is null or actor ~ '^0x[0-9a-f]{40}$'),
  location      text,
  uri           text,
  content_hash  text        check (content_hash is null or content_hash ~ '^0x[0-9a-f]{64}$'),
  metadata      jsonb       not null default '{}'::jsonb,
  occurred_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists checkpoints_batch_idx    on checkpoints (batch_id);
create index if not exists checkpoints_kind_idx      on checkpoints (kind);
create index if not exists checkpoints_created_idx    on checkpoints (created_at desc);

-- --- attestations (AttestationRegistry read model, append-only versions) -----
-- id = attestation hash or '<batchId>:<version>' (idempotent re-index key).
create table if not exists attestations (
  id            text        primary key,
  batch_id      text        not null check (batch_id ~ '^0x[0-9a-f]{64}$'),
  attester      text        check (attester is null or attester ~ '^0x[0-9a-f]{40}$'),
  score         integer     not null check (score between 0 and 10000),
  passed        boolean     not null,
  threshold     integer     not null default 0 check (threshold between 0 and 10000),
  version       integer     not null default 1 check (version >= 1),
  verdict_hash  text        check (verdict_hash is null or verdict_hash ~ '^0x[0-9a-f]{64}$'),
  uri           text,
  tx_hash       text        check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at    timestamptz not null default now()
);
create index if not exists attestations_batch_idx    on attestations (batch_id);
create index if not exists attestations_passed_idx     on attestations (passed);
create index if not exists attestations_created_idx     on attestations (created_at desc);

-- --- updated_at trigger (batches only; checkpoints/attestations append-only) --
drop trigger if exists batches_set_updated_at on batches;
create trigger batches_set_updated_at
  before update on batches
  for each row execute function set_updated_at();

-- --- RLS: enable + public read-only ------------------------------------------
do $$
declare
  t text;
  tables text[] := array['batches', 'checkpoints', 'attestations'];
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

-- >>> module: 10_letters_of_credit.sql ------------------------------------
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

-- >>> module: 11_factoring.sql --------------------------------------------
-- =============================================================================
-- Trade finance — Factoring agreements read model. Populated by the
-- @proofchain/api indexer from the FactoringAgreement contract. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps scores, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists factoring_agreements (
  id             text        primary key,
  invoice_id     text        check (invoice_id is null or invoice_id ~ '^0x[0-9a-f]{64}$'),
  seller         text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  factor         text        not null check (factor ~ '^0x[0-9a-f]{40}$'),
  token          text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  face_value     numeric(78, 0) not null default 0 check (face_value >= 0),
  advance_amount numeric(78, 0) not null default 0 check (advance_amount >= 0),
  advance_bps    integer     not null default 0 check (advance_bps between 0 and 10000),
  discount_bps   integer     not null default 0 check (discount_bps between 0 and 10000),
  recourse       boolean     not null default true,
  status         text        not null default 'proposed'
                             check (status in ('proposed', 'active', 'collected',
                                               'defaulted', 'settled', 'cancelled')),
  maturity_date  timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists factoring_agreements_seller_idx  on factoring_agreements (seller);
create index if not exists factoring_agreements_factor_idx   on factoring_agreements (factor);
create index if not exists factoring_agreements_status_idx    on factoring_agreements (status);
create index if not exists factoring_agreements_invoice_idx    on factoring_agreements (invoice_id);

do $$
declare
  t text;
  tables text[] := array['factoring_agreements'];
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

-- >>> module: 12_invoices.sql ---------------------------------------------
-- =============================================================================
-- Trade finance — invoices read model.
-- =============================================================================
-- Commercial invoices backing factoring / PO financing, populated by the
-- @proofchain/api indexer. Same conventions as 00_core.sql:
--   * On-chain identifiers as lowercase hex `text` with a format CHECK.
--   * uint256 amounts as numeric(78,0); `updated_at` via set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists invoices (
  id          text        primary key,
  batch_id    text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  seller      text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  buyer       text        check (buyer is null or buyer ~ '^0x[0-9a-f]{40}$'),
  token       text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount      numeric(78, 0) not null default 0 check (amount >= 0),
  currency    text,
  due_date    timestamptz,
  status      text        not null default 'issued'
                          check (status in ('draft', 'issued', 'paid', 'overdue',
                                            'cancelled', 'financed')),
  uri         text,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invoices_seller_idx  on invoices (seller);
create index if not exists invoices_buyer_idx    on invoices (buyer);
create index if not exists invoices_status_idx    on invoices (status);
create index if not exists invoices_batch_idx      on invoices (batch_id);

drop trigger if exists invoices_set_updated_at on invoices;
create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

alter table invoices enable row level security;
drop policy if exists invoices_read_all on invoices;
create policy invoices_read_all
  on invoices for select
  to anon, authenticated
  using (true);

-- >>> module: 13_po_financing.sql -----------------------------------------
-- =============================================================================
-- Trade finance — Purchase-order financing read model. Populated by the
-- @proofchain/api indexer from the PurchaseOrderFinancing contract. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps rates, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists po_financings (
  id            text        primary key,
  po_number     text,
  buyer         text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  supplier      text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  financier     text        check (financier is null or financier ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  po_amount     numeric(78, 0) not null default 0 check (po_amount >= 0),
  funded_amount numeric(78, 0) not null default 0 check (funded_amount >= 0),
  rate_bps      integer     not null default 0 check (rate_bps between 0 and 10000),
  status        text        not null default 'requested'
                            check (status in ('requested', 'approved', 'funded',
                                              'fulfilled', 'repaid', 'defaulted', 'cancelled')),
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  due_date      timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists po_financings_buyer_idx     on po_financings (buyer);
create index if not exists po_financings_supplier_idx   on po_financings (supplier);
create index if not exists po_financings_financier_idx    on po_financings (financier);
create index if not exists po_financings_status_idx        on po_financings (status);

do $$
declare
  t text;
  tables text[] := array['po_financings'];
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

-- >>> module: 14_dynamic_discounting.sql ----------------------------------
-- =============================================================================
-- Trade finance — Dynamic discounting read model. Populated by the
-- @proofchain/api indexer from the DynamicDiscounting contract. Early-payment
-- offers against approved invoices with a sliding APR curve. Conventions mirror
-- 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps rates, RLS, idempotent).
-- =============================================================================

create table if not exists dynamic_discounts (
  id             text        primary key,
  invoice_id     text        check (invoice_id is null or invoice_id ~ '^0x[0-9a-f]{64}$'),
  buyer          text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  supplier       text        not null check (supplier ~ '^0x[0-9a-f]{40}$'),
  token          text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  face_value     numeric(78, 0) not null default 0 check (face_value >= 0),
  discount_amount numeric(78, 0) not null default 0 check (discount_amount >= 0),
  apr_bps        integer     not null default 0 check (apr_bps between 0 and 10000),
  days_early     integer     not null default 0 check (days_early >= 0),
  status         text        not null default 'offered'
                             check (status in ('offered', 'accepted', 'paid',
                                               'expired', 'declined')),
  offer_expiry   timestamptz,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists dynamic_discounts_buyer_idx     on dynamic_discounts (buyer);
create index if not exists dynamic_discounts_supplier_idx   on dynamic_discounts (supplier);
create index if not exists dynamic_discounts_status_idx      on dynamic_discounts (status);
create index if not exists dynamic_discounts_invoice_idx      on dynamic_discounts (invoice_id);

do $$
declare
  t text;
  tables text[] := array['dynamic_discounts'];
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

-- >>> module: 15_supply_chain_finance.sql ---------------------------------
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

-- >>> module: 16_securitization.sql ---------------------------------------
-- =============================================================================
-- Trade finance — Receivable securitization read model. Populated by the
-- @proofchain/api indexer from ReceivableSecuritization + TrancheToken contracts.
-- A securitization pools receivables and issues seniority-ranked ERC20 tranches.
-- Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts, bps, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists securitizations (
  id              text        primary key,
  originator      text        not null check (originator ~ '^0x[0-9a-f]{40}$'),
  spv             text        check (spv is null or spv ~ '^0x[0-9a-f]{40}$'),
  token           text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  pool_value      numeric(78, 0) not null default 0 check (pool_value >= 0),
  receivable_count integer    not null default 0 check (receivable_count >= 0),
  status          text        not null default 'forming'
                             check (status in ('forming', 'issued', 'servicing',
                                               'redeemed', 'defaulted', 'closed')),
  uri             text,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists securitizations_originator_idx on securitizations (originator);
create index if not exists securitizations_status_idx      on securitizations (status);

create table if not exists tranches (
  id                text        primary key,
  securitization_id text        not null references securitizations (id) on delete cascade,
  tranche_token     text        check (tranche_token is null or tranche_token ~ '^0x[0-9a-f]{40}$'),
  seniority         integer     not null default 0 check (seniority >= 0),
  name              text,
  principal         numeric(78, 0) not null default 0 check (principal >= 0),
  coupon_bps        integer     not null default 0 check (coupon_bps between 0 and 10000),
  attachment_bps    integer     not null default 0 check (attachment_bps between 0 and 10000),
  detachment_bps    integer     not null default 10000 check (detachment_bps between 0 and 10000),
  rating            text,
  status            text        not null default 'outstanding'
                               check (status in ('outstanding', 'paying', 'defaulted', 'redeemed')),
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists tranches_securitization_idx on tranches (securitization_id);
create index if not exists tranches_token_idx           on tranches (tranche_token);
create index if not exists tranches_seniority_idx        on tranches (seniority);

do $$
declare
  t text;
  tables text[] := array['securitizations', 'tranches'];
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

-- >>> module: 17_credit_lines.sql -----------------------------------------
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

-- >>> module: 18_guarantees.sql -------------------------------------------
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

-- >>> module: 19_bills_of_exchange.sql ------------------------------------
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

-- >>> module: 20_certificates.sql -----------------------------------------
-- =============================================================================
-- Compliance — certificates read model (certificate of origin, phytosanitary,
-- halal, and other trade certificates). Populated by the @proofchain/api indexer
-- from the compliance contracts. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists certificates (
  id          text        primary key,
  kind        text        not null,
  batch_id    text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  holder      text        check (holder is null or holder ~ '^0x[0-9a-f]{40}$'),
  issuer      text        check (issuer is null or issuer ~ '^0x[0-9a-f]{40}$'),
  status      text        not null default 'valid'
                          check (status in ('valid', 'revoked', 'expired')),
  uri         text,
  expires_at  timestamptz,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists certificates_kind_idx    on certificates (kind);
create index if not exists certificates_batch_idx     on certificates (batch_id);
create index if not exists certificates_holder_idx     on certificates (holder);
create index if not exists certificates_status_idx      on certificates (status);

drop trigger if exists certificates_set_updated_at on certificates;
create trigger certificates_set_updated_at
  before update on certificates
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['certificates'];
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

-- >>> module: 21_sanctions.sql --------------------------------------------
-- =============================================================================
-- Compliance — Sanctions screening read model. Populated by the @proofchain/api
-- indexer from the SanctionsScreening contract. One row per screening event of a
-- counterparty against a sanctions list (OFAC/EU/UN). Conventions mirror
-- 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists sanctions_screenings (
  id            text        primary key,
  subject       text        not null check (subject ~ '^0x[0-9a-f]{40}$'),
  list_source   text        not null default 'ofac'
                            check (list_source in ('ofac', 'eu', 'un', 'uk', 'internal')),
  result        text        not null default 'clear'
                            check (result in ('clear', 'match', 'potential_match', 'blocked')),
  match_score   integer     not null default 0 check (match_score between 0 and 10000),
  screened_by   text        check (screened_by is null or screened_by ~ '^0x[0-9a-f]{40}$'),
  reference     text,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sanctions_screenings_subject_idx on sanctions_screenings (subject);
create index if not exists sanctions_screenings_result_idx   on sanctions_screenings (result);
create index if not exists sanctions_screenings_source_idx    on sanctions_screenings (list_source);

do $$
declare
  t text;
  tables text[] := array['sanctions_screenings'];
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

-- >>> module: 22_aml.sql --------------------------------------------------
-- =============================================================================
-- Compliance — AML registry read model. Populated by the @proofchain/api indexer
-- from the AMLRegistry contract. Per-subject AML risk ratings and flags.
-- Conventions mirror 00_core.sql (hex CHECKs, bps risk scores, RLS, idempotent).
-- =============================================================================

create table if not exists aml_records (
  id            text        primary key,
  subject       text        not null check (subject ~ '^0x[0-9a-f]{40}$'),
  risk_level    text        not null default 'low'
                            check (risk_level in ('low', 'medium', 'high', 'prohibited')),
  risk_score    integer     not null default 0 check (risk_score between 0 and 10000),
  status        text        not null default 'active'
                            check (status in ('active', 'under_review', 'cleared', 'flagged')),
  flags         jsonb       not null default '[]'::jsonb,
  assessor      text        check (assessor is null or assessor ~ '^0x[0-9a-f]{40}$'),
  reviewed_at   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists aml_records_subject_idx    on aml_records (subject);
create index if not exists aml_records_risk_level_idx  on aml_records (risk_level);
create index if not exists aml_records_status_idx       on aml_records (status);

do $$
declare
  t text;
  tables text[] := array['aml_records'];
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

-- >>> module: 23_trade_compliance.sql -------------------------------------
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

-- >>> module: 24_origin_certs.sql -----------------------------------------
-- =============================================================================
-- Compliance — Certificates of origin read model. Populated by the
-- @proofchain/api indexer from the CertificateOfOrigin contract. Declares the
-- economic origin of goods for preferential/non-preferential tariff treatment.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists certificates_of_origin (
  id             text        primary key,
  batch_id       text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  exporter       text        not null check (exporter ~ '^0x[0-9a-f]{40}$'),
  importer       text        check (importer is null or importer ~ '^0x[0-9a-f]{40}$'),
  issuer         text        check (issuer is null or issuer ~ '^0x[0-9a-f]{40}$'),
  origin_country text        not null,
  dest_country   text,
  hs_code        text,
  preferential   boolean     not null default false,
  status         text        not null default 'issued'
                             check (status in ('issued', 'verified', 'revoked', 'expired')),
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists certificates_of_origin_exporter_idx on certificates_of_origin (exporter);
create index if not exists certificates_of_origin_batch_idx     on certificates_of_origin (batch_id);
create index if not exists certificates_of_origin_status_idx     on certificates_of_origin (status);
create index if not exists certificates_of_origin_country_idx     on certificates_of_origin (origin_country);

do $$
declare
  t text;
  tables text[] := array['certificates_of_origin'];
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

-- >>> module: 25_phytosanitary.sql ----------------------------------------
-- =============================================================================
-- Compliance — Phytosanitary certificates read model. Populated by the
-- @proofchain/api indexer from the PhytosanitaryCertificate contract. Attests
-- that plant/agri consignments meet importing-country plant-health requirements.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists phytosanitary_certs (
  id             text        primary key,
  batch_id       text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  exporter       text        not null check (exporter ~ '^0x[0-9a-f]{40}$'),
  inspector      text        check (inspector is null or inspector ~ '^0x[0-9a-f]{40}$'),
  origin_country text        not null,
  dest_country   text,
  commodity      text,
  treatment      text,
  result         text        not null default 'passed'
                             check (result in ('passed', 'failed', 'conditional')),
  status         text        not null default 'issued'
                             check (status in ('issued', 'verified', 'revoked', 'expired')),
  inspected_at   timestamptz,
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists phytosanitary_certs_exporter_idx on phytosanitary_certs (exporter);
create index if not exists phytosanitary_certs_batch_idx     on phytosanitary_certs (batch_id);
create index if not exists phytosanitary_certs_status_idx     on phytosanitary_certs (status);

do $$
declare
  t text;
  tables text[] := array['phytosanitary_certs'];
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

-- >>> module: 26_halal.sql ------------------------------------------------
-- =============================================================================
-- Compliance — Halal certifications read model. Populated by the @proofchain/api
-- indexer from the HalalCertification contract. Attests product/process
-- conformity to halal standards by an accredited body. Conventions mirror
-- 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists halal_certifications (
  id             text        primary key,
  batch_id       text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  producer       text        not null check (producer ~ '^0x[0-9a-f]{40}$'),
  certifier      text        check (certifier is null or certifier ~ '^0x[0-9a-f]{40}$'),
  standard       text,
  scope          text,
  status         text        not null default 'certified'
                             check (status in ('certified', 'suspended', 'revoked', 'expired')),
  certified_at   timestamptz,
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists halal_certifications_producer_idx  on halal_certifications (producer);
create index if not exists halal_certifications_certifier_idx  on halal_certifications (certifier);
create index if not exists halal_certifications_batch_idx       on halal_certifications (batch_id);
create index if not exists halal_certifications_status_idx       on halal_certifications (status);

do $$
declare
  t text;
  tables text[] := array['halal_certifications'];
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

-- >>> module: 27_recalls.sql ----------------------------------------------
-- =============================================================================
-- Compliance — Product recall registry read model. Populated by the
-- @proofchain/api indexer from the ProductRecallRegistry contract. Tracks recall
-- notices against provenance batches/products with severity and remediation.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists product_recalls (
  id            text        primary key,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  initiator     text        not null check (initiator ~ '^0x[0-9a-f]{40}$'),
  severity      text        not null default 'medium'
                            check (severity in ('low', 'medium', 'high', 'critical')),
  reason        text,
  affected_units numeric(78, 0) not null default 0 check (affected_units >= 0),
  status        text        not null default 'open'
                            check (status in ('open', 'in_progress', 'resolved', 'withdrawn')),
  resolved_at   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists product_recalls_batch_idx     on product_recalls (batch_id);
create index if not exists product_recalls_initiator_idx  on product_recalls (initiator);
create index if not exists product_recalls_severity_idx    on product_recalls (severity);
create index if not exists product_recalls_status_idx       on product_recalls (status);

do $$
declare
  t text;
  tables text[] := array['product_recalls'];
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

-- >>> module: 28_export_licenses.sql --------------------------------------
-- =============================================================================
-- Compliance — Export license registry read model. Populated by the
-- @proofchain/api indexer from the ExportLicenseRegistry contract. Government
-- authorizations to export controlled/dual-use goods to a destination.
-- Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) quota, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists export_licenses (
  id             text        primary key,
  license_number text,
  holder         text        not null check (holder ~ '^0x[0-9a-f]{40}$'),
  authority      text        check (authority is null or authority ~ '^0x[0-9a-f]{40}$'),
  hs_code        text,
  dest_country   text,
  quota          numeric(78, 0) not null default 0 check (quota >= 0),
  used           numeric(78, 0) not null default 0 check (used >= 0),
  status         text        not null default 'active'
                             check (status in ('pending', 'active', 'suspended',
                                               'revoked', 'expired', 'exhausted')),
  issued_at      timestamptz,
  expiry_date    timestamptz,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists export_licenses_holder_idx   on export_licenses (holder);
create index if not exists export_licenses_status_idx    on export_licenses (status);
create index if not exists export_licenses_dest_idx       on export_licenses (dest_country);

do $$
declare
  t text;
  tables text[] := array['export_licenses'];
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

-- >>> module: 29_customs.sql ----------------------------------------------
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

-- >>> module: 30_passports.sql --------------------------------------------
-- =============================================================================
-- Digital Product Passport (DPP) — passports read model. Mirrors the on-chain
-- DigitalProductPassport (ERC721): one row per tokenId with lifecycle status.
-- Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `token_id` is a uint256 serialized as a base-10 string (numeric(78,0)).
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists passports (
  token_id      text        primary key,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  product_name  text,
  status        text        not null default 'draft'
                            check (status in ('draft', 'issued', 'active', 'recycled', 'retired')),
  data_uri      text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists passports_batch_idx  on passports (batch_id);
create index if not exists passports_owner_idx    on passports (owner);
create index if not exists passports_status_idx    on passports (status);

drop trigger if exists passports_set_updated_at on passports;
create trigger passports_set_updated_at
  before update on passports
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['passports'];
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

-- >>> module: 31_dpp_lifecycle.sql ----------------------------------------
-- =============================================================================
-- DPP — Digital Product Passport lifecycle events read model. Populated by the
-- @proofchain/api indexer from the DPPLifecycleRegistry contract. Append-only
-- lifecycle log (manufactured → sold → repaired → recycled) per passport token.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists dpp_lifecycle_events (
  id            text        primary key,
  token_id      text        not null,
  passport_id   text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  event_type    text        not null default 'manufactured'
                            check (event_type in ('manufactured', 'shipped', 'sold', 'installed',
                                                  'serviced', 'repaired', 'resold', 'refurbished',
                                                  'decommissioned', 'recycled', 'disposed')),
  actor         text        check (actor is null or actor ~ '^0x[0-9a-f]{40}$'),
  location      text,
  occurred_at   timestamptz not null default now(),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists dpp_lifecycle_events_token_idx  on dpp_lifecycle_events (token_id);
create index if not exists dpp_lifecycle_events_type_idx    on dpp_lifecycle_events (event_type);
create index if not exists dpp_lifecycle_events_occurred_idx on dpp_lifecycle_events (occurred_at);

do $$
declare
  t text;
  tables text[] := array['dpp_lifecycle_events'];
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

-- >>> module: 32_materials.sql --------------------------------------------
-- =============================================================================
-- DPP — Material composition read model. Populated by the @proofchain/api indexer
-- from the MaterialComposition contract. Per-passport bill of materials with
-- recycled-content and hazardous-substance flags (EU DPP requirement).
-- Conventions mirror 00_core.sql (hex CHECKs, bps fractions, RLS, idempotent).
-- =============================================================================

create table if not exists material_compositions (
  id             text        primary key,
  token_id       text        not null,
  passport_id    text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  material       text        not null,
  cas_number     text,
  mass_bps       integer     not null default 0 check (mass_bps between 0 and 10000),
  recycled_bps   integer     not null default 0 check (recycled_bps between 0 and 10000),
  hazardous      boolean     not null default false,
  origin_country text,
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists material_compositions_token_idx     on material_compositions (token_id);
create index if not exists material_compositions_material_idx   on material_compositions (material);
create index if not exists material_compositions_hazardous_idx   on material_compositions (hazardous);

do $$
declare
  t text;
  tables text[] := array['material_compositions'];
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

-- >>> module: 33_repairability.sql ----------------------------------------
-- =============================================================================
-- DPP — Repairability index read model. Populated by the @proofchain/api indexer
-- from the RepairabilityIndex contract. Scores a product's ease of repair
-- (spare-part availability, documentation, disassembly). Conventions mirror
-- 00_core.sql (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists repairability_scores (
  id               text        primary key,
  token_id         text        not null,
  passport_id      text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  assessor         text        check (assessor is null or assessor ~ '^0x[0-9a-f]{40}$'),
  overall_bps      integer     not null default 0 check (overall_bps between 0 and 10000),
  parts_bps        integer     not null default 0 check (parts_bps between 0 and 10000),
  docs_bps         integer     not null default 0 check (docs_bps between 0 and 10000),
  disassembly_bps  integer     not null default 0 check (disassembly_bps between 0 and 10000),
  grade            text,
  uri              text,
  metadata         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists repairability_scores_token_idx on repairability_scores (token_id);
create index if not exists repairability_scores_grade_idx  on repairability_scores (grade);

do $$
declare
  t text;
  tables text[] := array['repairability_scores'];
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

-- >>> module: 34_recycling.sql --------------------------------------------
-- =============================================================================
-- DPP — Recycling registry read model. Populated by the @proofchain/api indexer
-- from the RecyclingRegistry contract. Records end-of-life recycling/recovery of
-- a passported product and the material recovery achieved. Conventions mirror
-- 00_core.sql (hex CHECKs, numeric(78,0) mass, bps recovery, RLS, idempotent).
-- =============================================================================

create table if not exists recycling_records (
  id             text        primary key,
  token_id       text,
  passport_id    text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  recycler       text        not null check (recycler ~ '^0x[0-9a-f]{40}$'),
  method         text        not null default 'mechanical'
                             check (method in ('mechanical', 'chemical', 'thermal',
                                               'refurbish', 'reuse', 'landfill')),
  input_mass_g   numeric(78, 0) not null default 0 check (input_mass_g >= 0),
  recovered_mass_g numeric(78, 0) not null default 0 check (recovered_mass_g >= 0),
  recovery_bps   integer     not null default 0 check (recovery_bps between 0 and 10000),
  status         text        not null default 'recorded'
                             check (status in ('recorded', 'verified', 'disputed')),
  uri            text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists recycling_records_token_idx    on recycling_records (token_id);
create index if not exists recycling_records_recycler_idx  on recycling_records (recycler);
create index if not exists recycling_records_method_idx     on recycling_records (method);

do $$
declare
  t text;
  tables text[] := array['recycling_records'];
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

-- >>> module: 35_data_carriers.sql ----------------------------------------
-- =============================================================================
-- DPP — Data carrier registry read model. Populated by the @proofchain/api
-- indexer from the DPPDataCarrier contract. Maps physical GS1/QR/NFC/RFID
-- carriers to a passport token so a scan resolves to the on-chain DPP.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists dpp_data_carriers (
  id            text        primary key,
  token_id      text        not null,
  passport_id   text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  carrier_type  text        not null default 'qr'
                            check (carrier_type in ('qr', 'datamatrix', 'nfc', 'rfid', 'gs1_digital_link')),
  code          text        not null,
  gtin          text,
  resolve_url   text,
  status        text        not null default 'active'
                            check (status in ('active', 'deactivated', 'reissued')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists dpp_data_carriers_code_key on dpp_data_carriers (code);
create index if not exists dpp_data_carriers_token_idx        on dpp_data_carriers (token_id);
create index if not exists dpp_data_carriers_gtin_idx          on dpp_data_carriers (gtin);

do $$
declare
  t text;
  tables text[] := array['dpp_data_carriers'];
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

-- >>> module: 42_freight.sql ----------------------------------------------
-- =============================================================================
-- Logistics — freight bookings read model. Populated by the @proofchain/api
-- indexer from the FreightBooking contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists freight (
  id           text        primary key,
  batch_id     text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  shipper      text        check (shipper is null or shipper ~ '^0x[0-9a-f]{40}$'),
  carrier      text        check (carrier is null or carrier ~ '^0x[0-9a-f]{40}$'),
  origin       text,
  destination  text,
  status       text        not null default 'booked'
                           check (status in ('booked', 'in_transit', 'delivered', 'cancelled')),
  eta          timestamptz,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists freight_batch_idx    on freight (batch_id);
create index if not exists freight_shipper_idx    on freight (shipper);
create index if not exists freight_carrier_idx     on freight (carrier);
create index if not exists freight_status_idx       on freight (status);

drop trigger if exists freight_set_updated_at on freight;
create trigger freight_set_updated_at
  before update on freight
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['freight'];
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

-- >>> module: 43_containers.sql -------------------------------------------
-- =============================================================================
-- Logistics — containers read model. Populated by the @proofchain/api indexer
-- from the ContainerRegistry contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists containers (
  id                text        primary key,
  container_number  text,
  freight_id        text        references freight (id) on delete set null,
  batch_id          text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  status            text        not null default 'empty'
                                check (status in ('empty', 'loaded', 'sealed', 'in_transit', 'delivered')),
  location          text,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists containers_number_idx    on containers (container_number);
create index if not exists containers_freight_idx     on containers (freight_id);
create index if not exists containers_batch_idx        on containers (batch_id);
create index if not exists containers_status_idx        on containers (status);

drop trigger if exists containers_set_updated_at on containers;
create trigger containers_set_updated_at
  before update on containers
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['containers'];
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

-- >>> module: 44_cold_chain.sql -------------------------------------------
-- =============================================================================
-- Logistics — Cold-chain monitoring read model. Populated by the @proofchain/api
-- indexer from the ColdChainMonitor contract. Per-shipment temperature readings
-- and breach events (drives parametric cargo insurance payouts). Conventions
-- mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists cold_chain_readings (
  id             text        primary key,
  shipment_id    text        check (shipment_id is null or shipment_id ~ '^0x[0-9a-f]{64}$'),
  container_id   text,
  sensor         text        check (sensor is null or sensor ~ '^0x[0-9a-f]{40}$'),
  temperature_c  numeric(10, 4),
  humidity_bps   integer     check (humidity_bps is null or humidity_bps between 0 and 10000),
  min_threshold_c numeric(10, 4),
  max_threshold_c numeric(10, 4),
  breach         boolean     not null default false,
  recorded_at    timestamptz not null default now(),
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cold_chain_readings_shipment_idx on cold_chain_readings (shipment_id);
create index if not exists cold_chain_readings_container_idx on cold_chain_readings (container_id);
create index if not exists cold_chain_readings_breach_idx    on cold_chain_readings (breach);
create index if not exists cold_chain_readings_recorded_idx   on cold_chain_readings (recorded_at);

do $$
declare
  t text;
  tables text[] := array['cold_chain_readings'];
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

-- >>> module: 45_warehouses.sql -------------------------------------------
-- =============================================================================
-- Logistics — Bonded warehouse registry read model. Populated by the
-- @proofchain/api indexer from the BondedWarehouse contract. Registered
-- warehouses plus bonded inventory positions held under customs suspension.
-- Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) quantities, RLS,
-- idempotent DDL).
-- =============================================================================

create table if not exists warehouses (
  id            text        primary key,
  operator      text        not null check (operator ~ '^0x[0-9a-f]{40}$'),
  name          text,
  location      text,
  bonded        boolean     not null default false,
  capacity      numeric(78, 0) not null default 0 check (capacity >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'full', 'suspended', 'closed')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists warehouses_operator_idx on warehouses (operator);
create index if not exists warehouses_status_idx    on warehouses (status);

create table if not exists warehouse_positions (
  id            text        primary key,
  warehouse_id  text        not null references warehouses (id) on delete cascade,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  quantity      numeric(78, 0) not null default 0 check (quantity >= 0),
  status        text        not null default 'stored'
                            check (status in ('stored', 'released', 'seized', 'transferred')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists warehouse_positions_warehouse_idx on warehouse_positions (warehouse_id);
create index if not exists warehouse_positions_batch_idx      on warehouse_positions (batch_id);
create index if not exists warehouse_positions_owner_idx       on warehouse_positions (owner);

do $$
declare
  t text;
  tables text[] := array['warehouses', 'warehouse_positions'];
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

-- >>> module: 46_fleet.sql ------------------------------------------------
-- =============================================================================
-- Logistics — Fleet registry read model. Populated by the @proofchain/api indexer
-- from the FleetRegistry contract. Vehicles/vessels/aircraft available to
-- carriers for freight assignment. Conventions mirror 00_core.sql (hex CHECKs,
-- RLS, idempotent DDL).
-- =============================================================================

create table if not exists fleet_vehicles (
  id            text        primary key,
  carrier       text        not null check (carrier ~ '^0x[0-9a-f]{40}$'),
  vehicle_type  text        not null default 'truck'
                            check (vehicle_type in ('truck', 'van', 'rail', 'vessel',
                                                    'aircraft', 'barge', 'reefer')),
  identifier    text,
  capacity_kg   numeric(78, 0) not null default 0 check (capacity_kg >= 0),
  reefer        boolean     not null default false,
  status        text        not null default 'available'
                            check (status in ('available', 'assigned', 'in_transit',
                                              'maintenance', 'retired')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists fleet_vehicles_carrier_idx on fleet_vehicles (carrier);
create index if not exists fleet_vehicles_type_idx     on fleet_vehicles (vehicle_type);
create index if not exists fleet_vehicles_status_idx    on fleet_vehicles (status);

do $$
declare
  t text;
  tables text[] := array['fleet_vehicles'];
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

-- >>> module: 47_route_attestations.sql -----------------------------------
-- =============================================================================
-- Logistics — Route attestations read model. Populated by the @proofchain/api
-- indexer from the RouteAttestation contract. Signed geo/waypoint attestations
-- proving a shipment followed an agreed route. Conventions mirror 00_core.sql
-- (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists route_attestations (
  id            text        primary key,
  shipment_id   text        check (shipment_id is null or shipment_id ~ '^0x[0-9a-f]{64}$'),
  attestor      text        not null check (attestor ~ '^0x[0-9a-f]{40}$'),
  waypoint      text,
  latitude_e7   bigint,
  longitude_e7  bigint,
  sequence_no   integer     not null default 0 check (sequence_no >= 0),
  deviation_m   numeric(20, 4),
  on_route      boolean     not null default true,
  attested_at   timestamptz not null default now(),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists route_attestations_shipment_idx on route_attestations (shipment_id);
create index if not exists route_attestations_attestor_idx  on route_attestations (attestor);
create index if not exists route_attestations_seq_idx        on route_attestations (shipment_id, sequence_no);

do $$
declare
  t text;
  tables text[] := array['route_attestations'];
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

-- >>> module: 48_proof_of_delivery.sql ------------------------------------
-- =============================================================================
-- Logistics — Last-mile proof of delivery read model. Populated by the
-- @proofchain/api indexer from the LastMileProofOfDelivery contract. Signed
-- delivery confirmations closing out a freight leg. Conventions mirror
-- 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists proof_of_delivery (
  id            text        primary key,
  shipment_id   text        check (shipment_id is null or shipment_id ~ '^0x[0-9a-f]{64}$'),
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  courier       text        check (courier is null or courier ~ '^0x[0-9a-f]{40}$'),
  recipient     text        check (recipient is null or recipient ~ '^0x[0-9a-f]{40}$'),
  status        text        not null default 'delivered'
                            check (status in ('out_for_delivery', 'delivered', 'failed',
                                              'returned', 'disputed')),
  signature_uri text,
  proof_hash    text        check (proof_hash is null or proof_hash ~ '^0x[0-9a-f]{64}$'),
  location      text,
  delivered_at  timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists proof_of_delivery_shipment_idx on proof_of_delivery (shipment_id);
create index if not exists proof_of_delivery_batch_idx     on proof_of_delivery (batch_id);
create index if not exists proof_of_delivery_courier_idx    on proof_of_delivery (courier);
create index if not exists proof_of_delivery_status_idx      on proof_of_delivery (status);

do $$
declare
  t text;
  tables text[] := array['proof_of_delivery'];
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

-- >>> module: 50_commodities.sql ------------------------------------------
-- =============================================================================
-- Commodities — tokens, vaults and price oracle read model. Populated by the
-- @proofchain/api indexer from CommodityToken / CommodityVault / PriceOracle
-- contracts. Conventions mirror 00_core.sql (hex CHECKs, numeric(78,0) amounts,
-- RLS, idempotent DDL).
-- =============================================================================

create table if not exists commodities (
  id            text        primary key,
  symbol        text        not null,
  name          text,
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  category      text        not null default 'agri'
                            check (category in ('agri', 'metal', 'energy', 'soft', 'livestock', 'other')),
  unit          text,
  decimals      integer     not null default 18 check (decimals between 0 and 36),
  total_supply  numeric(78, 0) not null default 0 check (total_supply >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'delisted', 'suspended')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists commodities_symbol_key on commodities (symbol);
create index if not exists commodities_token_idx          on commodities (token);
create index if not exists commodities_category_idx        on commodities (category);

create table if not exists commodity_vaults (
  id            text        primary key,
  commodity_id  text        references commodities (id) on delete set null,
  custodian     text        check (custodian is null or custodian ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  collateral    numeric(78, 0) not null default 0 check (collateral >= 0),
  minted        numeric(78, 0) not null default 0 check (minted >= 0),
  status        text        not null default 'open'
                            check (status in ('open', 'locked', 'redeemed', 'liquidated')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists commodity_vaults_commodity_idx on commodity_vaults (commodity_id);
create index if not exists commodity_vaults_custodian_idx  on commodity_vaults (custodian);

create table if not exists commodity_prices (
  id            text        primary key,
  commodity_id  text        references commodities (id) on delete cascade,
  symbol        text,
  price         numeric(78, 0) not null default 0 check (price >= 0),
  currency      text        not null default 'USD',
  source        text,
  observed_at   timestamptz not null default now(),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists commodity_prices_commodity_idx on commodity_prices (commodity_id);
create index if not exists commodity_prices_observed_idx   on commodity_prices (observed_at);

do $$
declare
  t text;
  tables text[] := array['commodities', 'commodity_vaults', 'commodity_prices'];
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

-- >>> module: 51_harvests.sql ---------------------------------------------
-- =============================================================================
-- Commodities — Harvest registry read model. Populated by the @proofchain/api
-- indexer from the HarvestRegistry contract. Registers agricultural harvests
-- (farm, crop, yield) that seed provenance batches. Conventions mirror
-- 00_core.sql (hex CHECKs, numeric(78,0) yields, RLS, idempotent DDL).
-- =============================================================================

create table if not exists harvests (
  id            text        primary key,
  farmer        text        not null check (farmer ~ '^0x[0-9a-f]{40}$'),
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  crop          text,
  variety       text,
  yield_kg      numeric(78, 0) not null default 0 check (yield_kg >= 0),
  region        text,
  organic       boolean     not null default false,
  harvested_at  timestamptz,
  status        text        not null default 'recorded'
                            check (status in ('recorded', 'graded', 'stored', 'sold', 'spoiled')),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists harvests_farmer_idx on harvests (farmer);
create index if not exists harvests_batch_idx   on harvests (batch_id);
create index if not exists harvests_crop_idx     on harvests (crop);
create index if not exists harvests_status_idx    on harvests (status);

do $$
declare
  t text;
  tables text[] := array['harvests'];
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

-- >>> module: 52_grading.sql ----------------------------------------------
-- =============================================================================
-- Commodities — Grading registry read model. Populated by the @proofchain/api
-- indexer from the GradingRegistry contract. Quality grades assigned to
-- harvests/batches by accredited graders. Conventions mirror 00_core.sql
-- (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists gradings (
  id            text        primary key,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  harvest_id    text,
  grader        text        not null check (grader ~ '^0x[0-9a-f]{40}$'),
  grade         text        not null,
  score_bps     integer     not null default 0 check (score_bps between 0 and 10000),
  standard      text,
  status        text        not null default 'graded'
                            check (status in ('graded', 'verified', 'disputed', 'revoked')),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists gradings_batch_idx   on gradings (batch_id);
create index if not exists gradings_harvest_idx  on gradings (harvest_id);
create index if not exists gradings_grader_idx    on gradings (grader);
create index if not exists gradings_grade_idx      on gradings (grade);

do $$
declare
  t text;
  tables text[] := array['gradings'];
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

-- >>> module: 53_storage_receipts.sql -------------------------------------
-- =============================================================================
-- Commodities — Storage receipts read model. Populated by the @proofchain/api
-- indexer from the StorageReceipt contract. Negotiable warehouse receipts
-- representing stored commodity that can collateralize financing. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) quantities, RLS, idempotent).
-- =============================================================================

create table if not exists storage_receipts (
  id            text        primary key,
  warehouse_id  text,
  depositor     text        not null check (depositor ~ '^0x[0-9a-f]{40}$'),
  holder        text        check (holder is null or holder ~ '^0x[0-9a-f]{40}$'),
  commodity_id  text,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  quantity      numeric(78, 0) not null default 0 check (quantity >= 0),
  unit          text,
  status        text        not null default 'issued'
                            check (status in ('issued', 'pledged', 'transferred',
                                              'redeemed', 'cancelled')),
  expiry_date   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists storage_receipts_depositor_idx on storage_receipts (depositor);
create index if not exists storage_receipts_holder_idx     on storage_receipts (holder);
create index if not exists storage_receipts_warehouse_idx   on storage_receipts (warehouse_id);
create index if not exists storage_receipts_status_idx       on storage_receipts (status);

do $$
declare
  t text;
  tables text[] := array['storage_receipts'];
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

-- >>> module: 54_recs.sql -------------------------------------------------
-- =============================================================================
-- Energy/ESG — Renewable Energy Certificates (REC) read model. Populated by the
-- @proofchain/api indexer from the RenewableEnergyCertificate (ERC1155) contract.
-- Each row is a REC batch representing MWh of renewable generation. Conventions
-- mirror 00_core.sql (hex CHECKs, numeric(78,0) volumes, RLS, idempotent DDL).
-- =============================================================================

create table if not exists renewable_certificates (
  id            text        primary key,
  token_id      text,
  issuer        text        not null check (issuer ~ '^0x[0-9a-f]{40}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  energy_source text        not null default 'solar'
                            check (energy_source in ('solar', 'wind', 'hydro', 'geothermal',
                                                     'biomass', 'tidal', 'nuclear')),
  mwh           numeric(78, 0) not null default 0 check (mwh >= 0),
  facility      text,
  vintage_year  integer     check (vintage_year is null or vintage_year between 1990 and 2100),
  status        text        not null default 'issued'
                            check (status in ('issued', 'transferred', 'retired', 'cancelled')),
  retired_at    timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists renewable_certificates_issuer_idx on renewable_certificates (issuer);
create index if not exists renewable_certificates_owner_idx   on renewable_certificates (owner);
create index if not exists renewable_certificates_source_idx   on renewable_certificates (energy_source);
create index if not exists renewable_certificates_status_idx    on renewable_certificates (status);

do $$
declare
  t text;
  tables text[] := array['renewable_certificates'];
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

-- >>> module: 55_emissions.sql --------------------------------------------
-- =============================================================================
-- Energy/ESG — Emissions trading read model. Populated by the @proofchain/api
-- indexer from the EmissionsTrading contract. Allowance allocations and trades
-- in a cap-and-trade scheme (tonnes CO2e). Conventions mirror 00_core.sql
-- (hex CHECKs, numeric(78,0) volumes, RLS, idempotent DDL).
-- =============================================================================

create table if not exists emission_allowances (
  id            text        primary key,
  account       text        not null check (account ~ '^0x[0-9a-f]{40}$'),
  scheme        text,
  vintage_year  integer     check (vintage_year is null or vintage_year between 1990 and 2100),
  allocated     numeric(78, 0) not null default 0 check (allocated >= 0),
  surrendered   numeric(78, 0) not null default 0 check (surrendered >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'surrendered', 'expired', 'cancelled')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists emission_allowances_account_idx on emission_allowances (account);
create index if not exists emission_allowances_status_idx   on emission_allowances (status);

create table if not exists emission_trades (
  id            text        primary key,
  seller        text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  buyer         text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  volume        numeric(78, 0) not null default 0 check (volume >= 0),
  price         numeric(78, 0) not null default 0 check (price >= 0),
  status        text        not null default 'settled'
                            check (status in ('pending', 'settled', 'cancelled')),
  traded_at     timestamptz not null default now(),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists emission_trades_seller_idx on emission_trades (seller);
create index if not exists emission_trades_buyer_idx   on emission_trades (buyer);
create index if not exists emission_trades_traded_idx   on emission_trades (traded_at);

do $$
declare
  t text;
  tables text[] := array['emission_allowances', 'emission_trades'];
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

-- >>> module: 56_water_credits.sql ----------------------------------------
-- =============================================================================
-- Energy/ESG — Water credits read model. Populated by the @proofchain/api indexer
-- from the WaterCredit contract. Tradable credits representing verified water
-- savings/replenishment (kilolitres). Conventions mirror 00_core.sql (hex CHECKs,
-- numeric(78,0) volumes, RLS, idempotent DDL).
-- =============================================================================

create table if not exists water_credits (
  id            text        primary key,
  token_id      text,
  issuer        text        not null check (issuer ~ '^0x[0-9a-f]{40}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  volume_kl     numeric(78, 0) not null default 0 check (volume_kl >= 0),
  basin         text,
  project       text,
  vintage_year  integer     check (vintage_year is null or vintage_year between 1990 and 2100),
  status        text        not null default 'issued'
                            check (status in ('issued', 'transferred', 'retired', 'cancelled')),
  retired_at    timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists water_credits_issuer_idx on water_credits (issuer);
create index if not exists water_credits_owner_idx   on water_credits (owner);
create index if not exists water_credits_status_idx   on water_credits (status);
create index if not exists water_credits_basin_idx     on water_credits (basin);

do $$
declare
  t text;
  tables text[] := array['water_credits'];
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

-- >>> module: 57_biodiversity.sql -----------------------------------------
-- =============================================================================
-- Energy/ESG — Biodiversity credits read model. Populated by the @proofchain/api
-- indexer from the BiodiversityCredit contract. Credits representing verified
-- habitat/biodiversity uplift (hectares). Conventions mirror 00_core.sql
-- (hex CHECKs, numeric(78,0) areas, RLS, idempotent DDL).
-- =============================================================================

create table if not exists biodiversity_credits (
  id            text        primary key,
  token_id      text,
  issuer        text        not null check (issuer ~ '^0x[0-9a-f]{40}$'),
  owner         text        check (owner is null or owner ~ '^0x[0-9a-f]{40}$'),
  hectares      numeric(78, 0) not null default 0 check (hectares >= 0),
  habitat_type  text,
  project       text,
  region        text,
  vintage_year  integer     check (vintage_year is null or vintage_year between 1990 and 2100),
  status        text        not null default 'issued'
                            check (status in ('issued', 'transferred', 'retired', 'cancelled')),
  retired_at    timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists biodiversity_credits_issuer_idx on biodiversity_credits (issuer);
create index if not exists biodiversity_credits_owner_idx   on biodiversity_credits (owner);
create index if not exists biodiversity_credits_status_idx   on biodiversity_credits (status);

do $$
declare
  t text;
  tables text[] := array['biodiversity_credits'];
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

-- >>> module: 58_referrals.sql --------------------------------------------
-- =============================================================================
-- Growth — referrals read model. Tracks referrer/referee relationships and the
-- reward owed on conversion. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * uint256 reward amounts as numeric(78,0) with a `>= 0` CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists referrals (
  id             text        primary key,
  referrer       text        not null check (referrer ~ '^0x[0-9a-f]{40}$'),
  referee        text        check (referee is null or referee ~ '^0x[0-9a-f]{40}$'),
  code           text,
  status         text        not null default 'pending'
                             check (status in ('pending', 'converted', 'rewarded', 'expired')),
  reward_amount  numeric(78, 0) not null default 0 check (reward_amount >= 0),
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists referrals_referrer_idx  on referrals (referrer);
create index if not exists referrals_referee_idx     on referrals (referee);
create index if not exists referrals_code_idx         on referrals (code);
create index if not exists referrals_status_idx        on referrals (status);

drop trigger if exists referrals_set_updated_at on referrals;
create trigger referrals_set_updated_at
  before update on referrals
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['referrals'];
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

-- >>> module: 59_green_bonds.sql ------------------------------------------
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

-- >>> module: 60_worker_credentials.sql -----------------------------------
-- =============================================================================
-- Workforce — Worker credentials read model. Populated by the @proofchain/api
-- indexer from the WorkerCredential (soulbound ERC721) contract. Non-transferable
-- identity/qualification credentials bound to a worker address. Conventions
-- mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists worker_credentials (
  id              text        primary key,
  token_id        text,
  worker          text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  issuer          text        check (issuer is null or issuer ~ '^0x[0-9a-f]{40}$'),
  credential_type text        not null default 'identity'
                             check (credential_type in ('identity', 'license', 'certification',
                                                        'membership', 'clearance')),
  title           text,
  status          text        not null default 'active'
                             check (status in ('active', 'suspended', 'revoked', 'expired')),
  issued_at       timestamptz,
  expiry_date     timestamptz,
  uri             text,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists worker_credentials_worker_idx on worker_credentials (worker);
create index if not exists worker_credentials_issuer_idx  on worker_credentials (issuer);
create index if not exists worker_credentials_type_idx     on worker_credentials (credential_type);
create index if not exists worker_credentials_status_idx    on worker_credentials (status);

do $$
declare
  t text;
  tables text[] := array['worker_credentials'];
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

-- >>> module: 61_safety_training.sql --------------------------------------
-- =============================================================================
-- Workforce — Safety training registry read model. Populated by the
-- @proofchain/api indexer from the SafetyTrainingRegistry contract. Completion
-- records for occupational safety courses per worker. Conventions mirror
-- 00_core.sql (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists safety_trainings (
  id            text        primary key,
  worker        text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  provider      text        check (provider is null or provider ~ '^0x[0-9a-f]{40}$'),
  course        text        not null,
  course_code   text,
  score_bps     integer     not null default 0 check (score_bps between 0 and 10000),
  result        text        not null default 'passed'
                            check (result in ('passed', 'failed', 'in_progress')),
  status        text        not null default 'valid'
                            check (status in ('valid', 'expired', 'revoked')),
  completed_at  timestamptz,
  expiry_date   timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists safety_trainings_worker_idx   on safety_trainings (worker);
create index if not exists safety_trainings_provider_idx  on safety_trainings (provider);
create index if not exists safety_trainings_status_idx     on safety_trainings (status);

do $$
declare
  t text;
  tables text[] := array['safety_trainings'];
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

-- >>> module: 62_payroll.sql ----------------------------------------------
-- =============================================================================
-- Workforce — payroll read model. Mirrors the MilestonePayroll contract: worker
-- stablecoin payouts gated on delivery milestones. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * uint256 amounts as numeric(78,0) with a `>= 0` CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists payroll (
  id          text        primary key,
  worker      text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  employer    text        check (employer is null or employer ~ '^0x[0-9a-f]{40}$'),
  token       text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  amount      numeric(78, 0) not null default 0 check (amount >= 0),
  milestone   text,
  status      text        not null default 'pending'
                          check (status in ('pending', 'approved', 'paid', 'cancelled')),
  paid_at     timestamptz,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists payroll_worker_idx    on payroll (worker);
create index if not exists payroll_employer_idx    on payroll (employer);
create index if not exists payroll_status_idx       on payroll (status);

drop trigger if exists payroll_set_updated_at on payroll;
create trigger payroll_set_updated_at
  before update on payroll
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['payroll'];
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

-- >>> module: 63_skills.sql -----------------------------------------------
-- =============================================================================
-- Workforce — Skill attestations read model. Populated by the @proofchain/api
-- indexer from the SkillAttestation contract. Peer/employer attestations of a
-- worker's competencies at a proficiency level. Conventions mirror 00_core.sql
-- (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists skill_attestations (
  id            text        primary key,
  worker        text        not null check (worker ~ '^0x[0-9a-f]{40}$'),
  attestor      text        not null check (attestor ~ '^0x[0-9a-f]{40}$'),
  skill         text        not null,
  level         text        not null default 'intermediate'
                            check (level in ('novice', 'beginner', 'intermediate',
                                             'advanced', 'expert')),
  weight        integer     not null default 1 check (weight >= 0),
  status        text        not null default 'active'
                            check (status in ('active', 'revoked', 'disputed')),
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists skill_attestations_worker_idx   on skill_attestations (worker);
create index if not exists skill_attestations_attestor_idx  on skill_attestations (attestor);
create index if not exists skill_attestations_skill_idx      on skill_attestations (skill);

do $$
declare
  t text;
  tables text[] := array['skill_attestations'];
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

-- >>> module: 64_labor_compliance.sql -------------------------------------
-- =============================================================================
-- Workforce — Labor compliance registry read model. Populated by the
-- @proofchain/api indexer from the LaborComplianceRegistry contract. Audits of
-- an employer/site against labor standards (child labor, wages, hours, safety).
-- Conventions mirror 00_core.sql (hex CHECKs, bps scores, RLS, idempotent DDL).
-- =============================================================================

create table if not exists labor_compliance_audits (
  id            text        primary key,
  employer      text        not null check (employer ~ '^0x[0-9a-f]{40}$'),
  auditor       text        check (auditor is null or auditor ~ '^0x[0-9a-f]{40}$'),
  site          text,
  standard      text,
  score_bps     integer     not null default 0 check (score_bps between 0 and 10000),
  result        text        not null default 'compliant'
                            check (result in ('compliant', 'minor_findings', 'major_findings',
                                              'non_compliant')),
  status        text        not null default 'closed'
                            check (status in ('open', 'remediation', 'closed', 'escalated')),
  findings      jsonb       not null default '[]'::jsonb,
  audited_at    timestamptz,
  uri           text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists labor_compliance_audits_employer_idx on labor_compliance_audits (employer);
create index if not exists labor_compliance_audits_result_idx    on labor_compliance_audits (result);
create index if not exists labor_compliance_audits_status_idx     on labor_compliance_audits (status);

do $$
declare
  t text;
  tables text[] := array['labor_compliance_audits'];
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

-- >>> module: 72_sensors.sql ----------------------------------------------
-- =============================================================================
-- Data / oracle — IoT sensors read model. Mirrors the IoTSensorRegistry
-- contract: device registration + latest reading per sensor. Design rules
-- mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists sensors (
  id            text        primary key,
  device_id     text        not null,
  batch_id      text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  sensor_type   text,
  location      text,
  last_reading  numeric,
  unit          text,
  status        text        not null default 'active'
                            check (status in ('active', 'inactive', 'faulty')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sensors_device_idx  on sensors (device_id);
create index if not exists sensors_batch_idx     on sensors (batch_id);
create index if not exists sensors_status_idx     on sensors (status);

drop trigger if exists sensors_set_updated_at on sensors;
create trigger sensors_set_updated_at
  before update on sensors
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['sensors'];
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

-- >>> module: 73_inspections.sql ------------------------------------------
-- =============================================================================
-- Data / oracle — quality inspections read model. Mirrors the QualityInspection
-- contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * Basis-point scores CHECK-constrained 0..10000.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists inspections (
  id               text        primary key,
  batch_id         text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  inspector        text        check (inspector is null or inspector ~ '^0x[0-9a-f]{40}$'),
  inspection_type  text,
  result           text        not null default 'pending'
                               check (result in ('pending', 'passed', 'failed', 'waived')),
  score            integer     check (score is null or score between 0 and 10000),
  report_uri       text,
  metadata         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists inspections_batch_idx      on inspections (batch_id);
create index if not exists inspections_inspector_idx    on inspections (inspector);
create index if not exists inspections_result_idx        on inspections (result);

drop trigger if exists inspections_set_updated_at on inspections;
create trigger inspections_set_updated_at
  before update on inspections
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['inspections'];
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

-- >>> module: 74_lab_tests.sql --------------------------------------------
-- =============================================================================
-- Data / oracle — lab test attestations read model. Mirrors the
-- LabTestAttestation contract. Design rules mirror 00_core.sql:
--   * On-chain identifiers stored as lowercase hex `text` with a format CHECK.
--   * `updated_at` maintained by the shared set_updated_at() trigger.
--   * RLS enabled with a public read-only SELECT policy; writes via service role.
--   * Idempotent DDL — safe to re-run on every deploy.
-- =============================================================================

create table if not exists lab_tests (
  id           text        primary key,
  batch_id     text        check (batch_id is null or batch_id ~ '^0x[0-9a-f]{64}$'),
  lab          text        check (lab is null or lab ~ '^0x[0-9a-f]{40}$'),
  test_type    text,
  result       text        not null default 'pending'
                           check (result in ('pending', 'passed', 'failed')),
  report_hash  text        check (report_hash is null or report_hash ~ '^0x[0-9a-f]{64}$'),
  report_uri   text,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists lab_tests_batch_idx  on lab_tests (batch_id);
create index if not exists lab_tests_lab_idx      on lab_tests (lab);
create index if not exists lab_tests_result_idx    on lab_tests (result);

drop trigger if exists lab_tests_set_updated_at on lab_tests;
create trigger lab_tests_set_updated_at
  before update on lab_tests
  for each row execute function set_updated_at();

do $$
declare
  t text;
  tables text[] := array['lab_tests'];
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

-- >>> module: 75_oracles.sql ----------------------------------------------
-- =============================================================================
-- Data/oracle — Oracle aggregator read model. Populated by the @proofchain/api
-- indexer from the OracleAggregator contract. Registered oracle feeds and their
-- aggregated observations (median of submissions). Conventions mirror
-- 00_core.sql (hex CHECKs, numeric values, RLS, idempotent DDL).
-- =============================================================================

create table if not exists oracle_feeds (
  id            text        primary key,
  feed_key      text        not null,
  description   text,
  decimals      integer     not null default 8 check (decimals between 0 and 36),
  min_answers   integer     not null default 1 check (min_answers >= 1),
  status        text        not null default 'active'
                            check (status in ('active', 'paused', 'deprecated')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists oracle_feeds_key_key on oracle_feeds (feed_key);
create index if not exists oracle_feeds_status_idx       on oracle_feeds (status);

create table if not exists oracle_observations (
  id            text        primary key,
  feed_id       text        not null references oracle_feeds (id) on delete cascade,
  round_id      numeric(78, 0) not null default 0 check (round_id >= 0),
  answer        numeric(78, 0) not null default 0,
  answer_count  integer     not null default 0 check (answer_count >= 0),
  reporter      text        check (reporter is null or reporter ~ '^0x[0-9a-f]{40}$'),
  observed_at   timestamptz not null default now(),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists oracle_observations_feed_idx  on oracle_observations (feed_id);
create index if not exists oracle_observations_round_idx  on oracle_observations (feed_id, round_id);

do $$
declare
  t text;
  tables text[] := array['oracle_feeds', 'oracle_observations'];
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

-- >>> module: 76_data_market.sql ------------------------------------------
-- =============================================================================
-- Data/oracle — Data marketplace read model. Populated by the @proofchain/api
-- indexer from the DataMarketplace contract. Listings of datasets/streams for
-- sale plus purchase/access grants. Conventions mirror 00_core.sql (hex CHECKs,
-- numeric(78,0) prices, RLS, idempotent DDL).
-- =============================================================================

create table if not exists data_listings (
  id            text        primary key,
  seller        text        not null check (seller ~ '^0x[0-9a-f]{40}$'),
  token         text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  title         text,
  category      text,
  price         numeric(78, 0) not null default 0 check (price >= 0),
  license       text,
  sample_uri    text,
  status        text        not null default 'active'
                            check (status in ('active', 'paused', 'sold_out', 'delisted')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists data_listings_seller_idx   on data_listings (seller);
create index if not exists data_listings_category_idx  on data_listings (category);
create index if not exists data_listings_status_idx     on data_listings (status);

create table if not exists data_purchases (
  id            text        primary key,
  listing_id    text        not null references data_listings (id) on delete cascade,
  buyer         text        not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  price         numeric(78, 0) not null default 0 check (price >= 0),
  access_uri    text,
  status        text        not null default 'granted'
                            check (status in ('pending', 'granted', 'revoked', 'refunded')),
  expires_at    timestamptz,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists data_purchases_listing_idx on data_purchases (listing_id);
create index if not exists data_purchases_buyer_idx    on data_purchases (buyer);
create index if not exists data_purchases_status_idx    on data_purchases (status);

do $$
declare
  t text;
  tables text[] := array['data_listings', 'data_purchases'];
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

-- >>> module: 90_infra.sql ------------------------------------------------
-- =============================================================================
-- Infra internals — durable backends for the queue, outbox and migration runner.
-- =============================================================================
-- These tables back the Supabase-backed implementations of the in-memory
-- primitives shipped in src/queue, src/events and src/migrations. They are
-- server-internal: RLS is enabled with NO public policy, so anon/authenticated
-- access is denied and only the service role (which bypasses RLS) can touch them.
-- Idempotent like every module — safe to re-run.
-- =============================================================================

-- --- Generic job queue -------------------------------------------------------
create table if not exists queue_jobs (
  id           uuid        primary key default gen_random_uuid(),
  queue        text        not null default 'default',
  type         text        not null,
  payload      jsonb       not null default '{}'::jsonb,
  status       text        not null default 'pending'
                          check (status in ('pending', 'processing', 'succeeded', 'failed', 'dead')),
  attempts     integer     not null default 0 check (attempts >= 0),
  max_attempts integer     not null default 3 check (max_attempts >= 1),
  run_at       timestamptz not null default now(),
  locked_at    timestamptz,
  last_error   jsonb,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists queue_jobs_poll_idx   on queue_jobs (queue, status, run_at);
create index if not exists queue_jobs_status_idx  on queue_jobs (status);

-- --- Transactional outbox ----------------------------------------------------
create table if not exists outbox_events (
  id           uuid        primary key default gen_random_uuid(),
  aggregate    text        not null,
  aggregate_id text        not null,
  type         text        not null,
  payload      jsonb       not null default '{}'::jsonb,
  status       text        not null default 'pending'
                          check (status in ('pending', 'published', 'failed')),
  attempts     integer     not null default 0 check (attempts >= 0),
  published_at timestamptz,
  last_error   jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists outbox_events_poll_idx    on outbox_events (status, created_at);
create index if not exists outbox_events_aggregate_idx on outbox_events (aggregate, aggregate_id);

-- --- Applied migrations ledger ------------------------------------------------
create table if not exists schema_migrations (
  id          text        primary key,
  name        text        not null,
  checksum    text,
  applied_at  timestamptz not null default now()
);

-- --- updated_at triggers ------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['queue_jobs', 'outbox_events'];
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

-- --- RLS: enabled, no public policy (server-only, service role bypasses) ------
do $$
declare
  t text;
  tables text[] := array['queue_jobs', 'outbox_events', 'schema_migrations'];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
  end loop;
end
$$;
