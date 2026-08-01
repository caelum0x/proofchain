/**
 * Chain reader — the ONLY module that constructs a viem client for the API.
 *
 * It resolves the Base Sepolia chain + contract addresses/ABIs through
 * `@proofchain/shared` (single source of truth) and exposes a small read surface
 * consumed by routers (point reads) and the indexer (log scans). Writes are NOT
 * part of the API: it is a read/index service, so there is no wallet client and
 * no private key is ever loaded here.
 */
import {
  createPublicClient,
  http,
  type Abi,
  type Address,
  type Log,
  type PublicClient,
} from 'viem';
import {
  ABIS,
  CONTRACT_NAMES,
  chainForId,
  tryGetContractAddress,
  type ContractName,
} from '@proofchain/shared';
import type { ApiConfig } from '../config/env.js';
import type { Logger } from '../logger.js';
import { chainError, errorMessage } from './errors.js';

/** A deployed contract the indexer/readers can address: name + address + ABI. */
export interface ContractSource {
  readonly name: ContractName;
  readonly address: Address;
  readonly abi: Abi;
}

export interface GetLogsRange {
  readonly address: Address;
  readonly fromBlock: bigint;
  readonly toBlock: bigint;
}

export interface ChainReader {
  readonly chainId: number;
  /** Underlying viem client. Escape hatch for advanced reads. */
  readonly client: PublicClient;
  /** Latest block number. Wrapped so failures surface as a typed CHAIN_ERROR. */
  getBlockNumber(): Promise<bigint>;
  /** Raw event logs for one contract across a block range. */
  getLogs(range: GetLogsRange): Promise<Log[]>;
  /** Resolved address for a contract name, or undefined when not yet deployed. */
  addressOf(name: ContractName): Address | undefined;
  /** ABI for a contract name (present for every known contract). */
  abiOf(name: ContractName): Abi | undefined;
  /** Every contract that has BOTH a known ABI and a resolved address. */
  sources(): readonly ContractSource[];
}

/**
 * Build the chain reader from validated config. The RPC URL is injected into the
 * shared chain definition (Ethereum Sepolia by default) so explorer/multicall
 * metadata stays correct while the transport points at the operator's endpoint.
 */
export const createChainReader = (
  config: ApiConfig,
  logger: Logger,
): ChainReader => {
  const chain = chainForId(config.CHAIN_ID, config.BASE_SEPOLIA_RPC_URL);
  const client: PublicClient = createPublicClient({
    chain,
    transport: http(config.BASE_SEPOLIA_RPC_URL),
  });

  // Resolve addresses for the configured chain (defaults to Ethereum Sepolia).
  const addressOf = (name: ContractName): Address | undefined =>
    tryGetContractAddress(name, config.CHAIN_ID);

  const abiOf = (name: ContractName): Abi | undefined => ABIS[name];

  const sources = (): readonly ContractSource[] => {
    const out: ContractSource[] = [];
    for (const name of CONTRACT_NAMES) {
      const address = addressOf(name);
      const abi = abiOf(name);
      if (address !== undefined && abi !== undefined) {
        out.push({ name, address, abi });
      }
    }
    if (out.length === 0) {
      logger.warn(
        'chain: no deployed contract addresses resolved; indexer/readers will be idle until addresses are configured',
      );
    }
    return out;
  };

  return {
    chainId: config.CHAIN_ID,
    client,
    addressOf,
    abiOf,
    sources,

    async getBlockNumber(): Promise<bigint> {
      try {
        return await client.getBlockNumber();
      } catch (err) {
        throw chainError('Failed to read latest block number', {
          cause: errorMessage(err),
        });
      }
    },

    async getLogs({ address, fromBlock, toBlock }: GetLogsRange): Promise<Log[]> {
      try {
        return await client.getLogs({ address, fromBlock, toBlock });
      } catch (err) {
        throw chainError('Failed to read event logs', {
          cause: errorMessage(err),
          address,
          fromBlock: fromBlock.toString(),
          toBlock: toBlock.toString(),
        });
      }
    },
  };
};
