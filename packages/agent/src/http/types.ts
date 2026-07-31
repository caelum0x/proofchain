/**
 * Dependencies shared by the HTTP layer. Injected into the server factory so
 * routes stay thin and fully testable.
 */
import type { AppConfig } from '../config/env.js';
import type { ChainClient } from '../chain/client.js';
import type { JobStore } from '../jobs/store.js';
import type { Logger } from '../logger.js';
import type { Verifier } from '../verifier.js';

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  verifier: Verifier;
  jobStore: JobStore;
  chain: ChainClient;
}
