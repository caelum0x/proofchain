/**
 * Verifier facade.
 *
 * The full verification flow now lives in `pipelines/verification.ts` as a
 * registry-discoverable `Pipeline`. This module keeps the small, stable public
 * surface (`createVerifier`, the request/result/deps types) that the HTTP layer,
 * job store and composition root depend on, and simply delegates to the
 * registered pipeline. Behaviour is identical to the pre-registry verifier.
 */
import { runVerificationPipeline } from './pipelines/verification.js';
import type { ChainClient } from './chain/client.js';
import type { DocumentParser } from './anthropic/document-parser.js';
import type { VerdictPinner } from './verdict/pinner.js';
import type { Logger } from './logger.js';
import type { OrchestratorDeps } from './orchestrator/orchestrator.js';
import type { RiskAssessment } from './risk/registry.js';
import type { VerificationVerdict } from './shared.js';
import type { Hex, InputDocument } from './domain/types.js';

export interface VerifyRequest {
  batchId: Hex;
  documents: InputDocument[];
}

export interface VerifyResult {
  verdict: VerificationVerdict;
  txHash?: Hex;
  settleTxHash?: Hex;
  alreadyAttested: boolean;
  /** Advisory risk assessments (one per registered risk model). */
  risk?: RiskAssessment[];
}

export interface VerifierConfig {
  threshold: number;
  settleOnAttest: boolean;
  model: string;
  maxDocuments: number;
}

export interface VerifierDeps {
  chain: ChainClient;
  documentParser: DocumentParser;
  pinner: VerdictPinner;
  logger: Logger;
  config: VerifierConfig;
  /** Orchestrator deps sans context (anthropic client, rails, clock). */
  orchestrator: Omit<OrchestratorDeps, 'logger'> & { logger?: Logger };
}

export const createVerifier = (deps: VerifierDeps) => ({
  verify: (req: VerifyRequest): Promise<VerifyResult> =>
    runVerificationPipeline(deps, req),
});

export type Verifier = ReturnType<typeof createVerifier>;
