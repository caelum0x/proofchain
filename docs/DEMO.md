# ProofChain — Demo Script

A tight 3-minute demo that tells the story: **AI audits, the blockchain enforces.**

## Setup (before you present)

```bash
pnpm install
pnpm --filter @proofchain/contracts test    # show 55 green if asked
```

Have two terminals + a browser ready:
- **T1:** `bash scripts/local-e2e.sh` (or a live Base Sepolia deployment)
- **T2:** `pnpm --filter @proofchain/agent dev`
- **Browser:** `pnpm --filter @proofchain/web dev` → http://localhost:3000

Pre-seed two shipments so verdicts are reproducible on stage (see `docs/DEMO_DATA.md`):
1. **CLEAN** — invoice + bill of lading that match the on-chain provenance trail.
2. **FRAUD** — a tampered invoice whose totals/quantities don't reconcile.

---

## The 3-minute run

**0:00 — Problem (20s).**
"Supply chains lose billions to document fraud and slow, trust-heavy settlement. Today a
human has to audit every shipment before anyone gets paid. We remove that bottleneck:
an AI agent does the audit, and a smart contract enforces payment."

**0:20 — Supplier registers a shipment (25s).**
On the **Supplier** screen: register a batch (a `bytes32` id derived from `BATCH-CLEAN-001`),
add a checkpoint ("Port Klang"). Point out: *this provenance trail is the on-chain ground
truth the agent will audit against.*

**0:45 — Clean verification (40s).**
Upload the clean invoice + bill of lading, hit **Request Verification**. The agent:
reads the on-chain provenance, parses the docs with Claude, cross-checks them, scores
**0.96 (9600 bps)**, pins the verdict to IPFS, and writes a signed `attest()` on-chain.
Show the verdict + findings on the **Verifier dashboard**.

**1:25 — Autonomous settlement (35s).**
On the **Buyer** screen: fund the escrow with 1000 USDC, then **Settle**. Because the
score ≥ threshold, the escrow **releases** to the supplier automatically. Show the
supplier's USDC balance jump and the deal state = **Released**, with the tx on the
Base Sepolia explorer. *No human approved this payment — the attestation did.*

**2:00 — Fraud is caught and held (45s).**
Second shipment, tampered invoice. The agent flags an `INVOICE_TOTAL_MISMATCH`, scores
**0.31 (3100 bps)**. Fund + settle → the escrow **refuses to release** and moves to
**Disputed**; funds stay locked. Show the finding. *The fraudulent supplier does not get
paid — and no human had to catch it.*

**2:45 — Close (15s).**
"AI audits, the blockchain enforces. Trustless industrial settlement — deterministic,
auditable, and it works end-to-end today." Point at the passing `local-e2e.sh` output.

---

## Reproducible proof (no browser needed)

If a live demo is risky, run the deterministic script — it deploys and drives both
lifecycles on a local chain and asserts every outcome:

```bash
bash scripts/local-e2e.sh
```

Expected tail:

```
clean deal state (expect 2=Released):  2)
supplier USDC (expect 1000000000):     1000000000
fraud deal state (expect 4=Disputed):  4)
escrow holds fraud funds (expect 500000000): 500000000
after admin refund, escrow (expect 0): 0
```

## The one killer line for judges

> "The AI agent's score is reconciled deterministically against a rule-based score — the
> stricter one wins — so a fraudulent shipment can **never** be waved through by a
> nondeterministic model output. The model advises; the rules and the contract decide."
