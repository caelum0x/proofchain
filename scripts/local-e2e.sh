#!/usr/bin/env bash
# ProofChain — reproducible local end-to-end proof.
# Spins up anvil, deploys all 4 contracts, and runs BOTH lifecycle paths:
#   1. Clean shipment (score >= threshold)  -> settlement RELEASED to supplier
#   2. Fraudulent shipment (score < threshold) -> DISPUTED, funds held, then REFUNDED
#
# Requires: foundry (anvil, cast, forge). No API key / network needed.
# Usage: bash scripts/local-e2e.sh
set -euo pipefail

RPC=http://localhost:8545
CONTRACTS_DIR="$(cd "$(dirname "$0")/../packages/contracts" && pwd)"

cd "$CONTRACTS_DIR"
echo "==> starting anvil"
pkill -f "anvil" 2>/dev/null || true; sleep 1
anvil > /tmp/proofchain-anvil.log 2>&1 &
sleep 3

# All signers are anvil's own funded dev accounts (never hardcoded / never real-network keys).
DK=$(grep -A20 "Private Keys" /tmp/proofchain-anvil.log | grep -oE "0x[a-f0-9]{64}" | sed -n '1p')  # deployer / admin
BK=$(grep -A20 "Private Keys" /tmp/proofchain-anvil.log | grep -oE "0x[a-f0-9]{64}" | sed -n '2p')  # buyer
SK=$(grep -A20 "Private Keys" /tmp/proofchain-anvil.log | grep -oE "0x[a-f0-9]{64}" | sed -n '3p')  # supplier
AGENT_KEY=$(grep -A20 "Private Keys" /tmp/proofchain-anvil.log | grep -oE "0x[a-f0-9]{64}" | sed -n '5p')  # verification agent
AGENT=$(cast wallet address "$AGENT_KEY")
SUPPLIER=$(cast wallet address "$SK"); BUYER=$(cast wallet address "$BK")

echo "==> deploying contracts"
DEPLOYER_PRIVATE_KEY=$DK AGENT_ADDRESS=$AGENT \
  forge script script/Deploy.s.sol:Deploy --rpc-url $RPC --broadcast > /dev/null 2>&1
addr(){ python3 -c "import json;print(json.load(open('deployments/base-sepolia.json'))['$1'])"; }
PROV=$(addr ProvenanceRegistry)
ATT=$(addr AttestationRegistry)
ESC=$(addr SettlementEscrow)
USDC=$(addr MockUSDC)

send(){ cast send --rpc-url $RPC --private-key "$1" "${@:2}" >/dev/null; }
call(){ cast call --rpc-url $RPC "$@"; }

echo "==> funding agent gas + granting REGISTRAR_ROLE to supplier"
send "$DK" "$AGENT" --value 1ether
RROLE=$(call "$PROV" "REGISTRAR_ROLE()(bytes32)")
send "$DK" "$PROV" "grantRole(bytes32,address)" "$RROLE" "$SUPPLIER"

run_batch() {
  local label="$1" batch="$2" score="$3" amount="$4"
  echo "==> [$label] batchId=$batch score=$score"
  send "$SK" "$PROV" "registerBatch(bytes32,bytes32,string)" "$batch" "$(cast keccak "$label-origin")" "ipfs://mock/$label"
  send "$SK" "$PROV" "addCheckpoint(bytes32,string,uint64,bytes32)" "$batch" "Port Klang" 1785500000 "$(cast keccak "$label-cp")"
  send "$AGENT_KEY" "$ATT" "attest(bytes32,uint16,bytes32,string)" "$batch" "$score" "$(cast keccak "$label-verdict")" "ipfs://mock/$label-verdict"
  send "$BK" "$USDC" "mint(address,uint256)" "$BUYER" "$amount"
  send "$BK" "$USDC" "approve(address,uint256)" "$ESC" "$amount"
  send "$BK" "$ESC" "fund(bytes32,address,address,uint256)" "$batch" "$SUPPLIER" "$USDC" "$amount"
  send "$DK" "$ESC" "settle(bytes32)" "$batch"
}

CLEAN=$(cast keccak "BATCH-CLEAN-001")
FRAUD=$(cast keccak "BATCH-FRAUD-002")
run_batch "clean" "$CLEAN" 9600 1000000000
run_batch "fraud" "$FRAUD" 3100 500000000

echo ""
echo "================ ASSERTIONS ================"
CLEAN_STATE=$(call "$ESC" "getDeal(bytes32)((bytes32,address,address,address,uint256,uint8))" "$CLEAN" | grep -oE '[0-9]+\)$')
FRAUD_STATE=$(call "$ESC" "getDeal(bytes32)((bytes32,address,address,address,uint256,uint8))" "$FRAUD" | grep -oE '[0-9]+\)$')
echo "clean deal state (expect 2=Released):  $CLEAN_STATE"
echo "supplier USDC (expect 1000000000):     $(call "$USDC" 'balanceOf(address)(uint256)' "$SUPPLIER")"
echo "fraud deal state (expect 4=Disputed):  $FRAUD_STATE"
echo "escrow holds fraud funds (expect 500000000): $(call "$USDC" 'balanceOf(address)(uint256)' "$ESC")"
send "$DK" "$ESC" "refund(bytes32)" "$FRAUD"
echo "after admin refund, escrow (expect 0): $(call "$USDC" 'balanceOf(address)(uint256)' "$ESC")"

pkill -f "anvil" 2>/dev/null || true
echo "==> done (anvil stopped)"
