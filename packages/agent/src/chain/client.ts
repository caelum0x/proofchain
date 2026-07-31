/**
 * Chain client interface (injectable/mockable). Wraps all on-chain reads/writes
 * so the verifier never touches viem directly and tests can supply a mock.
 */
import type {
  Hex,
  OnchainAttestation,
  ProvenanceData,
} from '../domain/types.js';

export interface AttestParams {
  batchId: Hex;
  score: number; // uint16 bps
  verdictHash: Hex;
  verdictURI: string;
}

export interface TxResult {
  txHash: Hex;
}

export interface ChainClient {
  /** The agent signer address (has AGENT_ROLE). */
  readonly agentAddress: Hex;
  getProvenance(batchId: Hex): Promise<ProvenanceData>;
  isAttested(batchId: Hex): Promise<boolean>;
  getAttestation(batchId: Hex): Promise<OnchainAttestation | null>;
  attest(params: AttestParams): Promise<TxResult>;
  settle(batchId: Hex): Promise<TxResult>;
}
