/**
 * The core verification pipeline (SPEC "Agent" flow), extracted from the
 * verifier so it is a first-class, registry-discoverable `Pipeline`.
 *
 * Flow: provenance read → idempotency check → document parse → Claude
 * tool-calling loop → registry cross-checks → registry score reconciliation →
 * advisory risk models → verdict pin → on-chain attest → optional settle.
 *
 * Behaviour is identical to the legacy verifier: with only the builtin checks
 * and the builtin `model`+`rules` scorers registered, `runRegisteredChecks`
 * equals the old `runCrossChecks` and `reconcile` equals the old
 * `reconcileScore`. Every dependency is injected for offline unit testing.
 */
import { errorMessage, validationError } from '../errors.js';
import { mergeFindings } from '../domain/findings.js';
import { keccakOfString } from '../util/hashing.js';
import { runVerificationLoop } from '../orchestrator/orchestrator.js';
// Side-effect imports register the builtin checks, scorers and risk models.
import { runRegisteredChecks } from '../checks/index.js';
import { reconcile } from '../scoring/index.js';
import { assessRisk } from '../risk/index.js';
import { registerPipeline } from './registry.js';
import type { ChainClient } from '../chain/client.js';
import type { VerificationVerdict } from '../shared.js';
import type { Hex, InputDocument, ParsedDocument } from '../domain/types.js';
import type { VerifierDeps, VerifyRequest, VerifyResult } from '../verifier.js';

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

const parseDocuments = async (
  deps: VerifierDeps,
  documents: InputDocument[],
): Promise<ParsedDocument[]> => {
  // Parse sequentially to keep model sub-calls bounded and ordered.
  const parsed: ParsedDocument[] = [];
  for (const [index, doc] of documents.entries()) {
    parsed.push(await deps.documentParser.parse(doc, index));
  }
  return parsed;
};

export const runVerificationPipeline = async (
  deps: VerifierDeps,
  req: VerifyRequest,
): Promise<VerifyResult> => {
  const { chain, pinner, logger, config } = deps;
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
  //    TOCTOU window between isAttested and getAttestation.
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
  const documents = await parseDocuments(deps, req.documents);

  // 4. Run the Claude tool-calling loop.
  const loop = await runVerificationLoop(
    { ...deps.orchestrator, logger },
    { batchId, provenance, documents },
  );

  // 5. Deterministic cross-checks (registry), merged with model findings.
  const ruleFindings = runRegisteredChecks({ provenance, documents });
  const findings = mergeFindings(loop.findings, ruleFindings);

  // 6. Reconcile every registered scoring dimension (stricter-wins).
  const reconciliation = reconcile(
    { modelScore: loop.modelScore, findings, documents, provenance },
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

  // 7. Advisory risk models (do not gate the attestation).
  const risk = assessRisk({
    modelScore: loop.modelScore,
    findings,
    documents,
    provenance,
  });

  // 8. Build the canonical verdict, pin it, compute its on-chain hash.
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

  // 9. Attest on-chain.
  const { txHash } = await chain.attest({
    batchId,
    score: reconciliation.finalScore,
    verdictHash,
    verdictURI,
  });
  logger.info({ batchId, txHash }, 'verify: attested');

  // 10. Optionally settle (fail-soft — a settle error never invalidates the
  //     attestation that already landed on-chain).
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
    risk,
    ...(settleTxHash !== undefined ? { settleTxHash } : {}),
  };
};

/** The registered verification pipeline descriptor. */
export const VERIFICATION_PIPELINE = registerPipeline<
  VerifierDeps,
  VerifyRequest,
  VerifyResult
>({
  id: 'verification',
  description:
    'End-to-end batch verification: parse → model loop → cross-checks → ' +
    'score reconciliation → risk → attest → optional settle.',
  run: runVerificationPipeline,
});
