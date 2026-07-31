#!/usr/bin/env bash
# Submit a demo shipment's documents to the running agent's /verify endpoint.
# Usage: bash scripts/seed-verify.sh <clean|fraud>
# Requires the agent running (default http://localhost:8080) and the batch already
# registered on-chain. Needs: python3, curl.
set -euo pipefail

KIND="${1:-}"
if [[ "$KIND" != "clean" && "$KIND" != "fraud" ]]; then
  echo "usage: bash scripts/seed-verify.sh <clean|fraud>" >&2; exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_URL="${AGENT_URL:-http://localhost:8080}"

if [[ "$KIND" == "clean" ]]; then
  LABEL="BATCH-CLEAN-001"
else
  LABEL="BATCH-FRAUD-002"
fi
BATCH_ID=$(cast keccak "$LABEL")

INVOICE="$ROOT/demo/$KIND/invoice.txt"
BOL="$ROOT/demo/$KIND/bill-of-lading.txt"

# Build the JSON payload with base64-encoded documents (portable across GNU/BSD base64).
PAYLOAD=$(python3 - "$BATCH_ID" "$INVOICE" "$BOL" <<'PY'
import base64, json, sys
batch_id, invoice_path, bol_path = sys.argv[1], sys.argv[2], sys.argv[3]
def doc(name, path):
    with open(path, "rb") as f:
        return {"name": name, "mimeType": "text/plain",
                "dataBase64": base64.b64encode(f.read()).decode()}
print(json.dumps({"batchId": batch_id,
                  "documents": [doc("invoice.txt", invoice_path),
                                doc("bill-of-lading.txt", bol_path)]}))
PY
)

echo "==> POST $AGENT_URL/verify  batchId=$BATCH_ID ($LABEL)"
curl -sS -X POST "$AGENT_URL/verify" \
  -H 'content-type: application/json' \
  -d "$PAYLOAD" | python3 -m json.tool
