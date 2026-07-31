# ProofChain — Deployment & Operations

End-to-end guide to deploying ProofChain: contracts (Base Sepolia), the Supabase
database, the verification agent service, and the web dApp (Vercel) — plus how
every environment variable wires the pieces together.

> **Target chain:** Base Sepolia (`chainId 84532`). USDC on test networks uses a
> deployable `MockUSDC` (6 decimals); `SettlementEscrow` takes any ERC20 address
> so real USDC can be swapped in on mainnet.

---

## 0. Prerequisites

- Node.js `>= 22`, `pnpm@11`.
- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`) for contracts.
- A funded Base Sepolia deployer key (get test ETH from a Base Sepolia faucet).
- Accounts (all optional for local dev — the system degrades gracefully):
  - **Supabase** project (persistence).
  - **Pinata** account + JWT (IPFS pinning).
  - **Anthropic** API key (the agent's Claude calls).
  - **WalletConnect** project id (web wallet connect).

Copy the root env template and fill it in:

```bash
cp .env.example .env
```

The **Shared env vars** block in `docs/SPEC.md` and the root `.env.example` are the
authoritative list. Never commit `.env` — only `.env.example` is tracked.

---

## 1. Deploy contracts (Base Sepolia)

```bash
pnpm --filter @proofchain/contracts build          # forge build
pnpm --filter @proofchain/contracts test           # full revert + access-control suite
pnpm --filter @proofchain/contracts deploy:base-sepolia
```

Required env for deploy:

| Var                     | Used for                                             |
| ----------------------- | ---------------------------------------------------- |
| `BASE_SEPOLIA_RPC_URL`  | RPC endpoint the deploy script broadcasts through.   |
| `DEPLOYER_PRIVATE_KEY`  | Deployer account (pays gas, becomes `DEFAULT_ADMIN`). |
| `AGENT_ADDRESS`         | Granted `AGENT_ROLE` on `AttestationRegistry`.       |

`script/Deploy.s.sol` deploys all four contracts (`ProvenanceRegistry`,
`AttestationRegistry`, `SettlementEscrow`, `MockUSDC`), wires roles (grants
`AGENT_ROLE` to `AGENT_ADDRESS`), and writes addresses to
`packages/contracts/deployments/base-sepolia.json`. ABIs are exported to
`packages/shared/src/abis/` after build.

**After deploy:**

1. Commit `deployments/base-sepolia.json` (addresses are public, not secret).
2. `@proofchain/shared` reads these addresses; rebuild it:
   `pnpm --filter @proofchain/shared build`.
3. Fund the `MockUSDC` faucet for buyers as needed (`mint(address,uint256)`).

---

## 2. Provision Supabase

1. Create a Supabase project; note the project URL and the **service-role** key
   (Project Settings → API). The service-role key is a server-only secret.
2. Apply the schema:

   ```bash
   psql "$SUPABASE_DB_URL" -f packages/infra/schema.sql
   # or paste packages/infra/schema.sql into the SQL editor
   ```

3. RLS is enabled by the schema (deny-by-default; public read-only; writes only
   via the service role). No further console configuration is required.

Set for any service that persists state (the agent):

| Var                         | Notes                                            |
| --------------------------- | ------------------------------------------------ |
| `SUPABASE_URL`              | Project URL. Absent → infra store no-ops.        |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. **Never** expose to the browser.    |

> If these are unset the agent still runs, using an in-memory job fallback.

---

## 3. Configure IPFS (Pinata)

Create a Pinata JWT (API Keys → New Key) and set `PINATA_JWT`. Without it, the
infra IPFS client returns deterministic `ipfs://mock/<sha256>` URIs so verdict
pinning works offline for development and CI.

| Var                | Notes                                                        |
| ------------------ | ------------------------------------------------------------ |
| `PINATA_JWT`       | Enables real pinning. Absent → local mock fallback.          |
| `PINATA_API_URL`   | Optional override (default `https://api.pinata.cloud`).      |
| `IPFS_GATEWAY_URL` | Optional gateway override for building HTTPS content links.  |

---

## 4. Deploy the agent service (Railway / Fly.io)

The agent is a Node HTTP service (`POST /verify`, `GET /health`, `GET /jobs/:id`).

**Build & run:**

```bash
pnpm --filter @proofchain/agent build
pnpm --filter @proofchain/agent start      # serves on PORT (default 8080)
```

**Railway** (recommended for hackathon speed):

1. New project → deploy from the monorepo; set the service root to
   `packages/agent` (or a root Nixpacks/Docker build that runs the filter above).
2. Set env vars (below). Expose the service; note the public URL — it becomes the
   web app's `NEXT_PUBLIC_AGENT_API_URL`.

**Fly.io:**

```bash
fly launch --no-deploy        # from packages/agent (add a Dockerfile)
fly secrets set ANTHROPIC_API_KEY=... AGENT_PRIVATE_KEY=... BASE_SEPOLIA_RPC_URL=...
fly deploy
```

Agent env:

| Var                         | Required | Purpose                                                       |
| --------------------------- | -------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | yes      | Claude API key. Fail-fast at startup if missing.              |
| `AGENT_PRIVATE_KEY`         | yes      | Signer holding `AGENT_ROLE`; submits `attest(...)`.           |
| `BASE_SEPOLIA_RPC_URL`      | yes      | Chain reads (provenance) + writes (attest/settle).            |
| `SETTLE_ON_ATTEST`          | no       | `true` to auto-call `settle(batchId)` after a passing attest. |
| `PINATA_JWT`                | no       | Pin verdicts to IPFS (else local mock).                       |
| `SUPABASE_URL` / `..._KEY`  | no       | Persist jobs/verdicts (else in-memory fallback).              |

> **Key safety:** `AGENT_PRIVATE_KEY` must control only the agent signer account
> (the one granted `AGENT_ROLE`), never the deployer/admin key. Rotate on
> suspected exposure and re-grant `AGENT_ROLE` to the new address.

**Health checks:** point the platform's health probe at `GET /health` (verifies
RPC connectivity, chain id, and required env).

---

## 5. Deploy the web dApp (Vercel)

1. Import the repo into Vercel. Set **Root Directory** to `packages/web`.
2. Build command: `pnpm --filter @proofchain/web build`
   (Install command `pnpm install`; Vercel detects Next.js output.)
3. Set env vars in the Vercel project (Production + Preview):

| Var                          | Notes                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_CHAIN_ID`       | `84532` (Base Sepolia).                                      |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | WalletConnect Cloud project id.                            |
| `NEXT_PUBLIC_AGENT_API_URL`  | Public URL of the deployed agent service (step 4).           |

> Only `NEXT_PUBLIC_*` vars are exposed to the browser. **No private keys, no
> service-role key, no Anthropic key** ever go into the web package. Contract
> addresses/ABIs come from `@proofchain/shared`.

4. Deploy. Verify: connect a wallet, confirm the Base Sepolia network guard
   prompts a switch, and that the verifier dashboard loads on-chain events.

---

## 6. End-to-end env wiring (who reads what)

```
                 BASE_SEPOLIA_RPC_URL ──────────────┐
DEPLOYER_PRIVATE_KEY ─┐                              │
AGENT_ADDRESS ────────┤ contracts (Deploy.s.sol)     │
                      ▼                              │
        deployments/base-sepolia.json               │
                      │ (addresses + ABIs)           │
                      ▼                              │
                 @proofchain/shared                 │
                   ┌──┴───────────────┐              │
                   ▼                  ▼              ▼
                 web               agent  ◄──────────┘
   NEXT_PUBLIC_CHAIN_ID       ANTHROPIC_API_KEY
   NEXT_PUBLIC_WALLETCONNECT_ID   AGENT_PRIVATE_KEY  (holds AGENT_ROLE)
   NEXT_PUBLIC_AGENT_API_URL ─────► /verify          SETTLE_ON_ATTEST
                                     │
                                     ├─► PINATA_JWT ........ IPFS verdict pin
                                     └─► SUPABASE_URL +
                                         SUPABASE_SERVICE_ROLE_KEY ... jobs/verdicts
```

Golden rules:

- **Secrets stay server-side.** Deployer/agent private keys, Anthropic key, and
  the Supabase service-role key never reach the browser bundle.
- **`AGENT_ADDRESS` must equal the address of `AGENT_PRIVATE_KEY`** — the deploy
  grants `AGENT_ROLE` to `AGENT_ADDRESS`, and the agent signs with the matching key.
- **`NEXT_PUBLIC_AGENT_API_URL`** on the web app must point at the deployed agent.
- Everything optional (Supabase, Pinata) degrades gracefully so local/CI runs need
  no external accounts.

---

## 7. Post-deploy verification checklist

- [ ] `GET <agent>/health` returns ready (RPC + chain + env OK).
- [ ] Supplier can `registerBatch` + `addCheckpoint` (tx confirms on BaseScan).
- [ ] Buyer can `approve` MockUSDC and `fund` a deal.
- [ ] `POST <agent>/verify` returns a `VerificationVerdict` + attestation tx hash.
- [ ] Verdict JSON resolves at its `ipfs://` URI (or mock URI in dev).
- [ ] `settle(batchId)` releases funds for a passing score; disputes hold funds.
- [ ] Web dashboard reflects registered → attested → settled/disputed timeline.

## 8. Operations notes

- **Rotating the agent key:** deploy a new signer, `grantRole(AGENT_ROLE, new)` and
  `revokeRole(AGENT_ROLE, old)` from the admin, then update `AGENT_PRIVATE_KEY`
  and `AGENT_ADDRESS`.
- **Pausing settlement:** `SettlementEscrow` is `Pausable`; the admin can pause in
  an incident and refund disputed deals.
- **Schema migrations:** `schema.sql` is idempotent (`IF NOT EXISTS` / `OR
  REPLACE`); re-running is safe. Additive changes only for the read models.
- **Observability:** the agent uses structured (pino) logging; ship logs to your
  platform's log drain and alert on non-2xx `/verify` rates.
