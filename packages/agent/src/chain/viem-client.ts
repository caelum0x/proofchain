/**
 * Production ChainClient backed by viem. Reads ProvenanceRegistry &
 * AttestationRegistry, submits attest() with the agent signer, and optionally
 * settle() on SettlementEscrow. This is the ONLY module importing viem clients.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  attestationRegistryAbi,
  baseSepolia,
  CONTRACTS,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from '../shared.js';
import { AppError, chainError, errorMessage } from '../errors.js';
import type { AppConfig } from '../config/env.js';
import type { ChainClient, AttestParams, TxResult } from './client.js';
import type {
  Hex,
  OnchainAttestation,
  ProvenanceData,
} from '../domain/types.js';

/** The subset of addresses this client requires, guaranteed non-undefined. */
interface RequiredAddresses {
  provenanceRegistry: Address;
  attestationRegistry: Address;
  settlementEscrow: Address;
}

const resolveAddresses = (chainId: number): RequiredAddresses => {
  const addresses = CONTRACTS[chainId];
  if (addresses === undefined) {
    throw new AppError(
      'CONFIG_ERROR',
      `No deployed contract addresses for chainId ${chainId}`,
    );
  }
  // Keys are the PascalCase contract names exported by @proofchain/shared and
  // every entry is optional until deployed — validate presence explicitly so a
  // misconfiguration fails fast instead of resolving to `undefined` at runtime.
  const provenanceRegistry = addresses.ProvenanceRegistry;
  const attestationRegistry = addresses.AttestationRegistry;
  const settlementEscrow = addresses.SettlementEscrow;
  if (
    provenanceRegistry === undefined ||
    attestationRegistry === undefined ||
    settlementEscrow === undefined
  ) {
    throw new AppError(
      'CONFIG_ERROR',
      `Missing deployed contract address(es) for chainId ${chainId}`,
    );
  }
  return { provenanceRegistry, attestationRegistry, settlementEscrow };
};

export const createViemChainClient = (config: AppConfig): ChainClient => {
  const account: Account = privateKeyToAccount(config.AGENT_PRIVATE_KEY as Hex);
  const addresses = resolveAddresses(config.CHAIN_ID);
  const transport = http(config.BASE_SEPOLIA_RPC_URL);

  const publicClient: PublicClient = createPublicClient({
    chain: baseSepolia,
    transport,
  });
  const walletClient: WalletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport,
  });

  const readProvenance = async (batchId: Hex): Promise<ProvenanceData> => {
    const [batch, checkpoints] = await Promise.all([
      publicClient.readContract({
        address: addresses.provenanceRegistry,
        abi: provenanceRegistryAbi,
        functionName: 'getBatch',
        args: [batchId],
      }),
      publicClient.readContract({
        address: addresses.provenanceRegistry,
        abi: provenanceRegistryAbi,
        functionName: 'getCheckpoints',
        args: [batchId],
      }),
    ]);

    return {
      batchId,
      exists: batch.exists,
      supplier: batch.supplier,
      originHash: batch.originHash,
      metadataURI: batch.metadataURI,
      createdAt: Number(batch.createdAt),
      checkpoints: checkpoints.map((cp) => ({
        location: cp.location,
        timestamp: Number(cp.timestamp),
        dataHash: cp.dataHash,
      })),
    };
  };

  const waitForTx = async (txHash: Hex): Promise<TxResult> => {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    if (receipt.status !== 'success') {
      throw chainError('Transaction reverted', { txHash });
    }
    return { txHash };
  };

  return {
    agentAddress: account.address,

    async getProvenance(batchId: Hex): Promise<ProvenanceData> {
      try {
        return await readProvenance(batchId);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw chainError('Failed to read provenance', {
          cause: errorMessage(err),
        });
      }
    },

    async isAttested(batchId: Hex): Promise<boolean> {
      try {
        return await publicClient.readContract({
          address: addresses.attestationRegistry,
          abi: attestationRegistryAbi,
          functionName: 'isAttested',
          args: [batchId],
        });
      } catch (err) {
        throw chainError('Failed to read attestation status', {
          cause: errorMessage(err),
        });
      }
    },

    async getAttestation(batchId: Hex): Promise<OnchainAttestation | null> {
      try {
        const a = await publicClient.readContract({
          address: addresses.attestationRegistry,
          abi: attestationRegistryAbi,
          functionName: 'getAttestation',
          args: [batchId],
        });
        if (!a.exists) return null;
        return {
          batchId: a.batchId,
          score: Number(a.score),
          verdictHash: a.verdictHash,
          verdictURI: a.verdictURI,
          attestedAt: Number(a.attestedAt),
          agent: a.agent,
          exists: a.exists,
        };
      } catch (err) {
        throw chainError('Failed to read attestation', {
          cause: errorMessage(err),
        });
      }
    },

    async attest(params: AttestParams): Promise<TxResult> {
      try {
        const txHash = await walletClient.writeContract({
          account,
          chain: baseSepolia,
          address: addresses.attestationRegistry,
          abi: attestationRegistryAbi,
          functionName: 'attest',
          args: [
            params.batchId,
            params.score,
            params.verdictHash,
            params.verdictURI,
          ],
        });
        return await waitForTx(txHash);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw chainError('attest() transaction failed', {
          cause: errorMessage(err),
        });
      }
    },

    async settle(batchId: Hex): Promise<TxResult> {
      try {
        const txHash = await walletClient.writeContract({
          account,
          chain: baseSepolia,
          address: addresses.settlementEscrow,
          abi: settlementEscrowAbi,
          functionName: 'settle',
          args: [batchId],
        });
        return await waitForTx(txHash);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw chainError('settle() transaction failed', {
          cause: errorMessage(err),
        });
      }
    },
  };
};
