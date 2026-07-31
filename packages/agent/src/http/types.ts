/**
 * Dependencies shared by the HTTP layer. Injected into the server factory so
 * routes stay thin and fully testable.
 */
import type { AppConfig } from '../config/env.js';
import type { ChainClient } from '../chain/client.js';
import type { JobStore } from '../jobs/store.js';
import type { Logger } from '../logger.js';
import type { Verifier } from '../verifier.js';
import type { PipelineHttpDeps } from './pipeline-deps.js';

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  verifier: Verifier;
  jobStore: JobStore;
  chain: ChainClient;
  /**
   * Optional domain-pipeline dependencies. When present, the server mounts the
   * `/pipelines/*` routes (financing, insurance, dpp, compliance, quality, esg,
   * credit). Absent in the minimal verification-only configuration.
   */
  pipelines?: PipelineHttpDeps;
}
