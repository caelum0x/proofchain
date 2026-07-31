/**
 * Composition root. Loads + validates config (fail fast), builds every real
 * dependency, wires them into the Fastify server, and starts listening.
 * Nothing here contains business logic — it only assembles the injectable
 * pieces defined elsewhere.
 */
import { createAnthropicClient } from './anthropic/real-client.js';
import { createClaudeDocumentParser } from './anthropic/document-parser.js';
import { createViemChainClient } from './chain/viem-client.js';
import { loadConfig } from './config/env.js';
import { createInMemoryJobStore } from './jobs/store.js';
import { createInMemoryPipelineJobStore } from './jobs/pipeline-store.js';
import { createLogger } from './logger.js';
import { buildServer } from './http/server.js';
import { createPinner } from './verdict/pinner.js';
import { createVerifier } from './verifier.js';
import { AppError } from './errors.js';
import type { PipelineHttpDeps } from './http/pipeline-deps.js';
// Opt the "risk-scoring" category manifests into the shared registries at wiring
// time. These side-effect imports register the extended risk lenses (credit,
// counterparty, route, esg, liquidity) and scoring dimensions (authenticity,
// consistency, compliance, completeness, esg, risk, reconciled) alongside the
// foundation builtins, so the running service's registries collect EVERY module.
// The foundation barrels (risk/index.ts, scoring/index.ts) own only the builtins
// and are never edited; the integrator wires the manifests exactly here.
import './risk/models.js';
import './scoring/dimensions.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger(config);

  const anthropic = createAnthropicClient(config.ANTHROPIC_API_KEY);
  const chain = createViemChainClient(config);
  const documentParser = createClaudeDocumentParser(
    anthropic,
    config.ANTHROPIC_PARSE_MODEL,
    config.ANTHROPIC_MAX_TOKENS,
  );
  const pinner = createPinner(config.PINATA_JWT, logger);
  const jobStore = createInMemoryJobStore();

  const verifier = createVerifier({
    chain,
    documentParser,
    pinner,
    logger,
    config: {
      threshold: config.PASS_THRESHOLD_BPS,
      settleOnAttest: config.SETTLE_ON_ATTEST,
      model: config.ANTHROPIC_MODEL,
      maxDocuments: config.MAX_DOCUMENTS,
    },
    orchestrator: {
      anthropic,
      logger,
      model: config.ANTHROPIC_MODEL,
      maxTokens: config.ANTHROPIC_MAX_TOKENS,
      maxIterations: config.MAX_TOOL_ITERATIONS,
      timeoutMs: config.VERIFY_TIMEOUT_MS,
    },
  });

  // Domain-pipeline routes (financing, insurance, dpp, compliance, quality,
  // esg, credit) share the parser + orchestrator + chain-read wiring and run
  // the Claude tool-calling loop for their model score.
  const pipelines: PipelineHttpDeps = {
    logger,
    chain,
    documentParser,
    jobStore: createInMemoryPipelineJobStore(),
    config: {
      threshold: config.PASS_THRESHOLD_BPS,
      maxDocuments: config.MAX_DOCUMENTS,
      model: config.ANTHROPIC_MODEL,
    },
    orchestrator: {
      anthropic,
      model: config.ANTHROPIC_MODEL,
      maxTokens: config.ANTHROPIC_MAX_TOKENS,
      maxIterations: config.MAX_TOOL_ITERATIONS,
      timeoutMs: config.VERIFY_TIMEOUT_MS,
    },
  };

  const app = await buildServer({
    config,
    logger,
    verifier,
    jobStore,
    chain,
    pipelines,
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(
    { port: config.PORT, host: config.HOST, agent: chain.agentAddress },
    'agent listening',
  );
};

main().catch((err: unknown) => {
  const message =
    err instanceof AppError ? err.message : (err as Error).message ?? String(err);
  // eslint-disable-next-line no-console -- logger may not exist yet at boot.
  console.error(`Fatal startup error: ${message}`);
  process.exit(1);
});
