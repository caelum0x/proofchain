# @proofchain/contracts

Solidity contracts for **ProofChain** — AI-verified supply-chain provenance with
autonomous on-chain settlement. Built with [Foundry](https://book.getfoundry.sh/).

Target chain: **Base Sepolia** (chainId `84532`). USDC on test networks is provided by a
deployable `MockUSDC`; `SettlementEscrow` accepts any ERC20 token so real USDC can be
swapped in on mainnet.

## Contracts

| Contract | Purpose |
|----------|---------|
| `ProvenanceRegistry` | Append-only registry of shipment batches and route checkpoints (ground truth). Gated by `REGISTRAR_ROLE`. |
| `AttestationRegistry` | Immutable AI-agent verdicts (score in bps 0–10000, one per batch). Gated by `AGENT_ROLE`. |
| `SettlementEscrow` | Holds buyer USDC; releases to supplier when a passing attestation exists, else marks the deal `Disputed`. Admin can `refund`. `SafeERC20` + `ReentrancyGuard` + `Pausable`. |
| `MockUSDC` | ERC20 (6 decimals) with an open `mint` faucet for test networks. Not for mainnet. |

### Roles & thresholds

- `ProvenanceRegistry`: `DEFAULT_ADMIN_ROLE`, `REGISTRAR_ROLE`.
- `AttestationRegistry`: `DEFAULT_ADMIN_ROLE`, `AGENT_ROLE`.
- `SettlementEscrow`: `DEFAULT_ADMIN_ROLE` (dispute resolver / pauser). Configurable
  `passThreshold` (bps, default `7000`) via `setPassThreshold`. A deal with
  `scoreOf >= passThreshold` is **released**; strictly below is **disputed**.

### Lifecycle

```
registerBatch → addCheckpoint* → attest → fund → settle
                                                   ├─ score ≥ threshold → Released (supplier paid)
                                                   └─ score <  threshold → Disputed → refund (buyer)
```

## Setup

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation) and Node ≥ 22.

```bash
# from this package directory
cp .env.example .env   # fill in values
forge build            # dependencies (OpenZeppelin, forge-std) are vendored in lib/
```

Remappings and solc config live in `foundry.toml` (solc `0.8.24`, optimizer on).

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `pnpm build` | `forge build` then export ABIs to `../shared/src/abis/`. |
| `test` | `pnpm test` | `forge test -vvv`. |
| `coverage` | `pnpm coverage` | Branch/line coverage for `src/`. |
| `export:abis` | `pnpm export:abis` | Copy compiled ABI arrays into the shared package. |
| `deploy:base-sepolia` | `pnpm deploy:base-sepolia` | Deploy all 4 contracts, grant `AGENT_ROLE`, write `deployments/base-sepolia.json`. |
| `fmt` / `fmt:check` | `pnpm fmt` | Format Solidity. |

## Deployment

`script/Deploy.s.sol` deploys `ProvenanceRegistry`, `AttestationRegistry`,
`SettlementEscrow`, and `MockUSDC`, grants `AGENT_ROLE` to `AGENT_ADDRESS`, and writes the
addresses to `deployments/base-sepolia.json`.

```bash
export BASE_SEPOLIA_RPC_URL=...
export DEPLOYER_PRIVATE_KEY=...
export AGENT_ADDRESS=0x...
pnpm deploy:base-sepolia
```

The deploy account becomes `DEFAULT_ADMIN_ROLE` on all registries and the escrow.

## Environment variables

See `.env.example`. No secrets are hardcoded; the deploy script reads
`DEPLOYER_PRIVATE_KEY` and `AGENT_ADDRESS` from the environment and reverts if
`AGENT_ADDRESS` is unset.

| Var | Required for | Notes |
|-----|--------------|-------|
| `BASE_SEPOLIA_RPC_URL` | deploy | Base Sepolia RPC endpoint. |
| `DEPLOYER_PRIVATE_KEY` | deploy | Deploying account key. Keep out of git. |
| `AGENT_ADDRESS` | deploy | Address granted `AGENT_ROLE`. |
| `ETHERSCAN_API_KEY` | deploy (`--verify`) | Optional, for source verification. |

## Testing

51 tests across happy-path end-to-end, every custom-error revert, all access-control
paths, a reentrancy attempt against `SettlementEscrow.settle`, and the `passThreshold`
boundary (score exactly at / just below / just above). Coverage: 100% lines, statements,
branches, and functions on `src/`.

```bash
pnpm test
pnpm coverage
```

## ABI export

`forge build` writes artifacts to `out/`. `scripts/export-abis.mjs` extracts the ABI
array from each contract artifact and writes `ProvenanceRegistry.json`,
`AttestationRegistry.json`, `SettlementEscrow.json`, and `MockUSDC.json` into
`../shared/src/abis/` for consumption by the `agent` and `web` packages.
