#!/usr/bin/env node
// Copies compiled ABI arrays from Foundry `out/` into the shared package's abis dir.
// Fails fast (non-zero exit) if any expected artifact is missing.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const outDir = join(pkgRoot, "out");
const sharedAbisDir = join(pkgRoot, "..", "shared", "src", "abis");

const CONTRACTS = ["ProvenanceRegistry", "AttestationRegistry", "SettlementEscrow", "MockUSDC"];

function loadAbi(name) {
  const artifactPath = join(outDir, `${name}.sol`, `${name}.json`);
  if (!existsSync(artifactPath)) {
    throw new Error(`Missing artifact ${artifactPath}. Run \`forge build\` first.`);
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  if (!Array.isArray(artifact.abi)) {
    throw new Error(`Artifact ${artifactPath} has no abi array.`);
  }
  return artifact.abi;
}

function main() {
  mkdirSync(sharedAbisDir, { recursive: true });
  const failures = [];
  for (const name of CONTRACTS) {
    try {
      const abi = loadAbi(name);
      const dest = join(sharedAbisDir, `${name}.json`);
      writeFileSync(dest, `${JSON.stringify(abi, null, 2)}\n`);
      console.log(`exported ${name} -> ${dest} (${abi.length} entries)`);
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
    }
  }
  if (failures.length > 0) {
    console.error("ABI export failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log(`Exported ${CONTRACTS.length} ABIs to ${sharedAbisDir}`);
}

main();
