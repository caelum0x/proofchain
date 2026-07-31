/**
 * Verification pipeline orchestration.
 *
 * Ties together: provenance read → idempotency check → document parse → Claude
 * tool-calling loop → deterministic cross-checks → score reconciliation →
 * verdict pin → on-chain attest → optional settle. Every dependency is injected
 * so the whole pipeline is unit-testable with mocks and no network.
 */
import { errorMessage, validationError } from './errors.js';
import { runCrossChecks } from './domain/crosscheck.js';
import { mergeFindings } from './domain/findings.js';
import { reconcileScore } from './domain/scoring.js';
import { runVerificationLoop, type OrchestratorDeps } from './orchestrator/orchestrator.js';
import { keccakOfString } from './util/hashing.js';
import type { ChainClient } from './chain/client.js';
import type { DocumentParser } from './anthropic/document-parser.js';
import type { VerdictPinner } from './verdict/pinner.js';
import type { Logger } from './logger.js';
import type { VerificationVerdict } from './shared.js';
import type {
  Hex,
  InputDocument,
  ParsedDocument,
} from './domain/types.js';

export interface VerifyRequest {
  batchId: Hex;
  documents: InputDocument[];
}

export interface VerifyResult {
  verdict: VerificationVerdict;
  txHash?: Hex;
  settleTxHash?: Hex;
  alreadyAttested: boolean;
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

/** Reconstruct a verdict envelope from an existing on-chain attestation. */
const verdictFromAttestation = (
  batchId: Hex,
  attestation: NonNullable<Awaited<ReturnType<ChainClient['getAttestation']>>>,
  threshold: number,
  model: string,
): VerificationVerdict => ({
  batchId,
  score: attestation.score,
  passed: attestation.score >= threshold,
  threshold,
  findings: [],
  documentHashes: [],
  verdictURI: attestation.verdictURI,
  createdAt: new Date(attestation.attestedAt * 1000).toISOString(),
  model,
});

export const createVerifier = (deps: VerifierDeps) => {
  const { chain, documentParser, pinner, logger, config } = deps;

  const parseDocuments = async (
    documents: InputDocument[],
  ): Promise<ParsedDocument[]> => {
    // Parse sequentially to keep model sub-calls bounded and ordered.
    const parsed: ParsedDocument[] = [];
    for (const [index, doc] of documents.entries()) {
      parsed.push(await documentParser.parse(doc, index));
    }
    return parsed;
  };

  const verify = async (req: VerifyRequest): Promise<VerifyResult> => {
    const { batchId } = req;
    logger.info({ batchId, documents: req.documents.length }, 'verify: start');

    // Enforce the document limit in the domain layer too (not just the HTTP
    // schema), so every entry point respects the configured cap.
    if (req.documents.length > config.maxDocuments) {
      throw validationError(
        `Too many documents: ${req.documents.length} exceeds the limit of ${config.maxDocuments}`,
      );
    }

    // 1. Read provenance up front (also validates the batch is knowable).
    const provenance = await chain.getProvenance(batchId);

    // 2. Idempotency: never double-attest. A SINGLE getAttestation call avoids a
    //    TOCTOU window between isAttested and getAttestation — if isAttested were
    //    true but getAttestation raced to null we would fall through and attest()
    //    would revert AlreadyAttested (SPEC: "if already attested, return existing").
    const existing = await chain.getAttestation(batchId);
    if (existing !== null) {
      logger.info({ batchId }, 'verify: already attested; returning existing');
      return {
        verdict: verdictFromAttestation(
          batchId,
          existing,
          config.threshold,
          config.model,
        ),
        alreadyAttested: true,
      };
    }

    // 3. Parse all documents (structured field extraction).
    const documents = await parseDocuments(req.documents);

    // 4. Run the Claude tool-calling loop.
    const loop = await runVerificationLoop(
      { ...deps.orchestrator, logger },
      { batchId, provenance, documents },
    );

    // 5. Deterministic cross-checks, merged with model-recorded findings.
    const ruleFindings = runCrossChecks({ provenance, documents });
    const findings = mergeFindings(loop.findings, ruleFindings);

    // 6. Reconcile: take the stricter of model score vs rule score.
    const reconciliation = reconcileScore(
      loop.modelScore,
      findings,
      config.threshold,
    );
    logger.info(
      {
        batchId,
        modelScore: reconciliation.modelScore,
        ruleScore: reconciliation.ruleScore,
        finalScore: reconciliation.finalScore,
        source: reconciliation.source,
        passed: reconciliation.passed,
      },
      'verify: score reconciled',
    );

    // 7. Build the canonical verdict, pin it, compute its on-chain hash.
    const coreVerdict = {
      batchId,
      score: reconciliation.finalScore,
      passed: reconciliation.passed,
      threshold: config.threshold,
      findings,
      documentHashes: documents.map((d) => d.sha256),
      createdAt: new Date().toISOString(),
      model: config.model,
    } satisfies Omit<VerificationVerdict, 'verdictURI'>;

    const verdictURI = await pinner.pinJson(coreVerdict);
    const verdictHash = keccakOfString(JSON.stringify(coreVerdict));
    const verdict: VerificationVerdict = { ...coreVerdict, verdictURI };

    // 8. Attest on-chain.
    const { txHash } = await chain.attest({
      batchId,
      score: reconciliation.finalScore,
      verdictHash,
      verdictURI,
    });
    logger.info({ batchId, txHash }, 'verify: attested');

    // 9. Optionally settle (fail-soft — a settle error never invalidates the
    //    attestation that already landed on-chain).
    let settleTxHash: Hex | undefined;
    if (config.settleOnAttest) {
      try {
        settleTxHash = (await chain.settle(batchId)).txHash;
        logger.info({ batchId, settleTxHash }, 'verify: settled');
      } catch (err) {
        logger.error(
          { batchId, err: errorMessage(err) },
          'verify: settle failed (attestation already recorded)',
        );
      }
    }

    return {
      verdict,
      txHash,
      alreadyAttested: false,
      ...(settleTxHash !== undefined ? { settleTxHash } : {}),
    };
  };

  return { verify };
};

export type Verifier = ReturnType<typeof createVerifier>;
