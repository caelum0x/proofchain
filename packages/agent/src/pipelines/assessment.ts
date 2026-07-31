/**
 * Shared verification ASSESSMENT — the read-only core the domain pipelines
 * (financing, insurance, dpp, compliance, quality, esg, credit) build on.
 *
 * It composes the same registries the verification pipeline uses — document
 * parsers, cross-checks, scorers and risk models — but performs NO on-chain
 * writes (no attest/settle) and no verdict pinning. Downstream pipelines layer
 * their domain decision on the returned facts.
 *
 * Model score sourcing (in priority order):
 *   1. An explicit `modelScore` on the request (caller already ran the model).
 *   2. The Claude tool-calling loop, when an `orchestrator` is injected — this
 *      is where the pipelines "compose tools".
 *   3. A deterministic rules-only fallback (model score = 10000) so the flow is
 *      fully offline-runnable with no Anthropic client at all.
 *
 * Every dependency is injected, so the whole thing is unit-testable with mocks.
 */
import { validationError } from '../errors.js';
import { mergeFindings } from '../domain/findings.js';
import { assertValidModelScore } from '../domain/scoring.js';
import { MAX_SCORE_BPS } from '../config/constants.js';
import { runVerificationLoop } from '../orchestrator/orchestrator.js';
// Side-effect imports register the builtin checks, scorers and risk models so a
// pipeline that only imports THIS module still gets a fully wired assessment.
import { runRegisteredChecks } from '../checks/index.js';
import { reconcile } from '../scoring/index.js';
import { assessRisk } from '../risk/index.js';
import type { ScoreReconciliation } from '../scoring/index.js';
import type { RiskAssessment } from '../risk/index.js';
import type { AnthropicClient } from '../anthropic/client.js';
import type { ChainClient } from '../chain/client.js';
import type { DocumentParser } from '../anthropic/document-parser.js';
import type { Logger } from '../logger.js';
import type { Finding } from '../shared.js';
import type {
  Hex,
  InputDocument,
  ParsedDocument,
  ProvenanceData,
} from '../domain/types.js';

/** The tuning knobs an assessment needs (a subset of the verifier config). */
export interface AssessmentConfig {
  /** Pass threshold in basis points. */
  readonly threshold: number;
  /** Hard cap on documents per request. */
  readonly maxDocuments: number;
  /** Model id recorded in outputs (advisory only). */
  readonly model: string;
}

/** Injected Claude tool-calling loop dependencies (optional). */
export interface AssessmentOrchestrator {
  readonly anthropic: AnthropicClient;
  readonly model: string;
  readonly maxTokens: number;
  readonly maxIterations: number;
  readonly timeoutMs: number;
  /** Injectable clock for deterministic timeout tests. */
  readonly now?: () => number;
}

export interface AssessmentDeps {
  /** Only the provenance read is needed — assessments never write on-chain. */
  readonly chain: Pick<ChainClient, 'getProvenance'>;
  readonly documentParser: DocumentParser;
  readonly logger: Logger;
  readonly config: AssessmentConfig;
  /** When present, the model loop sources the model score + model findings. */
  readonly orchestrator?: AssessmentOrchestrator;
}

/** The common request shape every domain pipeline accepts. */
export interface AssessmentRequest {
  readonly batchId: Hex;
  readonly documents: InputDocument[];
  /** Pre-computed model score (0..10000); skips the model loop when supplied. */
  readonly modelScore?: number;
}

/** The read-only facts a domain pipeline reasons over. */
export interface Assessment {
  readonly batchId: Hex;
  readonly provenance: ProvenanceData;
  readonly documents: ParsedDocument[];
  readonly findings: Finding[];
  readonly reconciliation: ScoreReconciliation;
  readonly risk: RiskAssessment[];
  readonly modelScore: number;
  readonly modelSummary: string;
}

interface ModelOutcome {
  readonly modelScore: number;
  readonly findings: Finding[];
  readonly summary: string;
}

const parseDocuments = async (
  deps: AssessmentDeps,
  documents: InputDocument[],
): Promise<ParsedDocument[]> => {
  const parsed: ParsedDocument[] = [];
  for (const [index, doc] of documents.entries()) {
    parsed.push(await deps.documentParser.parse(doc, index));
  }
  return parsed;
};

const resolveModel = async (
  deps: AssessmentDeps,
  batchId: Hex,
  provenance: ProvenanceData,
  documents: ParsedDocument[],
  override: number | undefined,
): Promise<ModelOutcome> => {
  if (override !== undefined) {
    return {
      modelScore: assertValidModelScore(override),
      findings: [],
      summary: 'Model score supplied by caller; model loop skipped.',
    };
  }
  if (deps.orchestrator !== undefined) {
    const loop = await runVerificationLoop(
      { ...deps.orchestrator, logger: deps.logger },
      { batchId, provenance, documents },
    );
    return {
      modelScore: loop.modelScore,
      findings: loop.findings,
      summary: loop.summary,
    };
  }
  return {
    modelScore: MAX_SCORE_BPS,
    findings: [],
    summary: 'Deterministic rules-only assessment (no model loop configured).',
  };
};

/**
 * Run the shared assessment: parse documents, read provenance, source a model
 * score, run every registered cross-check, reconcile all scoring dimensions and
 * assess every risk model. Pure with respect to the chain (read-only).
 */
export const runAssessment = async (
  deps: AssessmentDeps,
  req: AssessmentRequest,
): Promise<Assessment> => {
  const { logger, config } = deps;
  const { batchId } = req;

  if (req.documents.length === 0) {
    throw validationError('At least one document is required');
  }
  if (req.documents.length > config.maxDocuments) {
    throw validationError(
      `Too many documents: ${req.documents.length} exceeds the limit of ${config.maxDocuments}`,
    );
  }

  logger.info(
    { batchId, documents: req.documents.length },
    'assessment: start',
  );

  const provenance = await deps.chain.getProvenance(batchId);
  const documents = await parseDocuments(deps, req.documents);
  const model = await resolveModel(
    deps,
    batchId,
    provenance,
    documents,
    req.modelScore,
  );

  const ruleFindings = runRegisteredChecks({ provenance, documents });
  const findings = mergeFindings(model.findings, ruleFindings);

  const reconciliation = reconcile(
    { modelScore: model.modelScore, findings, documents, provenance },
    config.threshold,
  );
  const risk = assessRisk({
    modelScore: model.modelScore,
    findings,
    documents,
    provenance,
  });

  logger.info(
    {
      batchId,
      finalScore: reconciliation.finalScore,
      passed: reconciliation.passed,
      findings: findings.length,
    },
    'assessment: complete',
  );

  return {
    batchId,
    provenance,
    documents,
    findings,
    reconciliation,
    risk,
    modelScore: model.modelScore,
    modelSummary: model.summary,
  };
};
