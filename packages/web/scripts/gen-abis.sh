#!/usr/bin/env bash
#
# Regenerate the bundled contract ABIs + typed registry for @proofchain/web.
#
# Copies the authoritative ABIs from @proofchain/shared (which mirrors the
# @proofchain/contracts build output) into src/lib/abis-generated/ and rewrites
# the typed `GENERATED_ABIS` barrel. Also refreshes the bundled deployment
# manifest. Run from the web package root: `bash scripts/gen-abis.sh`.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
shared_abis="$here/../shared/src/abis"
manifest="$here/../contracts/deployments/base-sepolia.json"
out_dir="$here/src/lib/abis-generated"
dep_dir="$here/src/lib/deployments"

mkdir -p "$out_dir" "$dep_dir"
cp "$shared_abis"/*.json "$out_dir/"
[ -f "$manifest" ] && cp "$manifest" "$dep_dir/base-sepolia.json"

index="$out_dir/index.ts"
{
  echo "/**"
  echo " * AUTO-GENERATED — do not edit by hand."
  echo " *"
  echo " * Full contract ABIs for every ProofChain platform contract, copied from"
  echo " * @proofchain/contracts build output (mirrored in @proofchain/shared/src/abis)."
  echo " * Bundled here so the web package is independently type-checkable and"
  echo " * buildable, and so page agents can read/write every contract via wagmi."
  echo " *"
  echo " * Regenerate with scripts/gen-abis.sh after contracts change."
  echo " */"
  echo 'import type { Abi } from "viem";'
  echo ""
  for f in "$out_dir"/*.json; do
    name="$(basename "$f" .json)"
    echo "import ${name}Json from \"./${name}.json\";"
  done
  echo ""
  echo "/** Every platform contract ABI, keyed by canonical contract name. */"
  echo "export const GENERATED_ABIS = {"
  for f in "$out_dir"/*.json; do
    name="$(basename "$f" .json)"
    echo "  ${name}: ${name}Json as Abi,"
  done
  echo "} as const;"
  echo ""
  echo "export type GeneratedContractName = keyof typeof GENERATED_ABIS;"
} > "$index"

echo "Regenerated $(ls "$out_dir"/*.json | wc -l | tr -d ' ') ABIs into $out_dir"
