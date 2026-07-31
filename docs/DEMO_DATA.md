# Demo Seed Data

Two reproducible shipments live under [`demo/`](../demo):

| Shipment | Files | Expected agent verdict |
|----------|-------|------------------------|
| **Clean** | `demo/clean/invoice.txt`, `demo/clean/bill-of-lading.txt` | High score (≈0.96) → attestation passes → escrow **releases** |
| **Fraud** | `demo/fraud/invoice.txt`, `demo/fraud/bill-of-lading.txt` | Low score (≈0.31) → findings `INVOICE_TOTAL_MISMATCH`, `QUANTITY_MISMATCH` → escrow **disputes** |

The fraud invoice's **Total Due** (USD 500) contradicts its line-item subtotal (USD 1,000),
and its declared housing quantity (4,000) exceeds the bill-of-lading manifest (1,000) — the
two anomalies the agent's cross-checks are designed to catch
(`INVOICE_TOTAL_MISMATCH`, `QUANTITY_MISMATCH`).

## Feeding them to the agent

The agent's `POST /verify` accepts documents as `{ name, mimeType, dataBase64 | url }`.
With the agent running (`pnpm --filter @proofchain/agent dev`, default `:8080`):

```bash
bash scripts/seed-verify.sh clean   # or: fraud
```

The batch must already be registered on-chain (the web **Supplier** screen or
`scripts/local-e2e.sh` does this). `batchId` is `keccak256("BATCH-CLEAN-001")` /
`keccak256("BATCH-FRAUD-002")`.

## Batch IDs (keccak256 of the label)

```
BATCH-CLEAN-001 -> 0x679ce0c24a7bff44bdd872ba3b0e48d550aafaebe4f8d241a51b4f352581dc58
BATCH-FRAUD-002 -> 0x955f88cf36d90406d406b5e179242331182f3301563b49a6a798dcb2fbedaff3
```
