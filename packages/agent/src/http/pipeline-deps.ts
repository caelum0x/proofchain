/**
 * Dependencies the pipeline HTTP routes need, and the adapter that turns them
 * into the `AssessmentDeps` every domain pipeline consumes. Kept separate from
 * the verification `AppDeps` so the pipeline surface is opt-in: the server only
 * mounts pipeline routes when these deps are supplied.
 */
import type { ChainClient } from '../chain/client.js';
import type { DocumentParser } from '../anthropic/document-parser.js';
import type { Logger } from '../logger.js';
import type { PipelineJobStore } from '../jobs/pipeline-store.js';
import type {
  AssessmentConfig,
  AssessmentDeps,
  AssessmentOrchestrator,
} from '../pipelines/assessment.js';

export interface PipelineHttpDeps {
  readonly logger: Logger;
  /** Only the provenance read is used; pipelines never write on-chain. */
  readonly chain: Pick<ChainClient, 'getProvenance'>;
  readonly documentParser: DocumentParser;
  readonly jobStore: PipelineJobStore;
  readonly config: AssessmentConfig;
  /** When present, pipelines run the Claude tool-calling loop for a model score. */
  readonly orchestrator?: AssessmentOrchestrator;
}

/** Project the HTTP deps down to the assessment deps a pipeline runs against. */
export const toAssessmentDeps = (deps: PipelineHttpDeps): AssessmentDeps => ({
  chain: deps.chain,
  documentParser: deps.documentParser,
  logger: deps.logger,
  config: deps.config,
  ...(deps.orchestrator !== undefined ? { orchestrator: deps.orchestrator } : {}),
});
