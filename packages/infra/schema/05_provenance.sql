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
