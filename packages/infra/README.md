# @proofchain/infra

Infrastructure primitives for **ProofChain** — AI-verified supply-chain provenance
with autonomous on-chain settlement.

This package is **standalone** (it does not depend on the other workspace
packages) and provides three things:

1. **Supabase schema + typed client** — persistence for verification `jobs`, cached
   `verdicts`, and a `deals` read-model that mirrors on-chain settlement.
2. **IPFS pinning** — `pinJson` / `pinFile` via Pinata, with a deterministic
   **local mock fallback** (`ipfs://mock/<sha256>`) so the whole system runs with
   zero external accounts.
3. **Deploy / ops docs** — end-to-end deployment and env wiring, see
   [`docs/DEPLOY.md`](./docs/DEPLOY.md).

## Design principles

- **Graceful degradation.** No infra dependency is mandatory. Supabase no-ops when
  unconfigured; IPFS falls back to a local mock. The system always runs.
- **No secrets in code.** Everything is read from env and validated at load time.
- **Structured errors, never swallowed.** Every fallible call returns a
  `Result<T>` envelope (`{ success, data, error }`) with a stable error `code`.
- **Validation at every boundary.** Zod schemas (mirrors of `schema.sql`) validate
  data going into and coming out of the database.
- **Immutable style, strict TypeScript, small focused files.**

## Setup

```bash
pnpm install          # from the repo root (installs the whole workspace)
pnpm --filter @proofchain/infra build
```

Apply the database schema to your Supabase project:

```bash
psql "$SUPABASE_DB_URL" -f packages/infra/schema.sql
# or paste schema.sql into the Supabase SQL editor
```

## Scripts

| Script          | Description                                  |
| --------------- | -------------------------------------------- |
| `build`         | Compile TypeScript to `dist/` (tsc).         |
| `typecheck`     | Type-check without emitting.                 |
| `test`          | Run the vitest suite once.                   |
| `test:watch`    | Run vitest in watch mode.                    |
| `test:coverage` | Run tests with v8 coverage.                  |

## Environment variables

All variables are **optional** — the package degrades gracefully — but a provided
value must be well-formed (a malformed `SUPABASE_URL` fails fast at load).

| Variable                    | Required?             | Purpose                                                   |
| --------------------------- | --------------------- | --------------------------------------------------------- |
| `SUPABASE_URL`              | for persistence       | Supabase project URL. Absent → store no-ops.              |
| `SUPABASE_SERVICE_ROLE_KEY` | for persistence       | Service-role key (server-only, bypasses RLS).             |
| `PINATA_JWT`                | for real IPFS pinning | Pinata JWT. Absent → local `ipfs://mock/<sha256>` pinning. |
| `PINATA_API_URL`            | optional override     | Defaults to `https://api.pinata.cloud`.                   |
| `IPFS_GATEWAY_URL`          | optional override     | Defaults to `https://gateway.pinata.cloud/ipfs`.          |

See [`.env.example`](./.env.example) for this package and the repo-root
`.env.example` for the full cross-package set.

## Usage

### IPFS

```ts
import { createIpfsClient } from "@proofchain/infra";

const ipfs = createIpfsClient(); // backend chosen from env
const res = await ipfs.pinJson({ verdict: "..." });
if (res.success) {
  console.log(res.data.uri); // ipfs://<cid> or ipfs://mock/<sha256>
} else {
  console.error(res.error.code, res.error.message);
}
```

### Supabase store

```ts
import { createSupabaseStore } from "@proofchain/infra";

const store = await createSupabaseStore(); // no-op if SUPABASE_URL unset
if (!store.isConfigured) {
  // fall back to in-memory state
}

const write = await store.upsertJob({ batchId: "0x…", status: "queued", request: {} });
const read = await store.getJob(jobId); // Result<Job | null>
```

## Data model

| Table      | Key         | Purpose                                                     |
| ---------- | ----------- | ----------------------------------------------------------- |
| `jobs`     | `id` (uuid) | Verification jobs + status, request payload, result, error. |
| `verdicts` | `batch_id`  | One cached verdict per batch (mirrors attestation).         |
| `deals`    | `batch_id`  | Read-model mirror of on-chain `SettlementEscrow` deals.     |

**Row Level Security:** RLS is enabled on all tables (deny-by-default). Public
(anon) access is **read-only**; all writes go through the service role on the
server, which bypasses RLS. Full policy is documented inline in
[`schema.sql`](./schema.sql).

## Testing

```bash
pnpm --filter @proofchain/infra test
```

Covers the IPFS local fallback (sha256 URI derivation, determinism), the Pinata
backend (mocked `fetch`), the Supabase no-op path, config loading, hashing, and
the boundary schemas.
