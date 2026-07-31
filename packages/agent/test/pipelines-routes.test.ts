/**
 * HTTP tests for the domain-pipeline routes. Builds the real Fastify server with
 * mocked chain + stubbed parser (no Anthropic, deterministic rules-only path)
 * and exercises the `{ success, data, error }` envelope, job persistence,
 * validation errors and the pipeline listing. Registries are reset to the
 * builtin baseline per test for determinism.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { loadConfig, type AppConfig } from '../src/config/env.js';
import { createInMemoryJobStore } from '../src/jobs/store.js';
import { createInMemoryPipelineJobStore } from '../src/jobs/pipeline-store.js';
import { createVerifier } from '../src/verifier.js';
import { checkRegistry, registerChecks } from '../src/checks/registry.js';
import { CORE_CHECKS } from '../src/domain/crosscheck.js';
import { scorerRegistry } from '../src/scoring/registry.js';
import { modelScorer, rulesScorer } from '../src/scoring/core.js';
import { riskRegistry } from '../src/risk/registry.js';
import { fraudRiskModel } from '../src/risk/fraud.js';
import type { PipelineHttpDeps } from '../src/http/pipeline-deps.js';
import type { ChainClient } from '../src/chain/client.js';
import type { ParsedDocument } from '../src/domain/types.js';
import {
  SAMPLE_BATCH,
  invoiceDoc,
  localPinner,
  mockChainClient,
  sampleProvenance,
  scriptedAnthropic,
  silentLogger,
  stubDocumentParser,
} from './helpers.js';

const testConfig = (): AppConfig =>
  loadConfig({
    ANTHROPIC_API_KEY: 'test-key',
    AGENT_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    BASE_SEPOLIA_RPC_URL: 'http://localhost:8545',
    NODE_ENV: 'test',
  });

const rawInput = {
  name: 'invoice.pdf',
  mimeType: 'application/pdf',
  dataBase64: 'aGVsbG8=',
};

beforeEach(() => {
  checkRegistry.reset();
  registerChecks(CORE_CHECKS);
  scorerRegistry.reset();
  scorerRegistry.register(modelScorer);
  scorerRegistry.register(rulesScorer);
  riskRegistry.reset();
  riskRegistry.register(fraudRiskModel);
});

const buildApp = (opts: {
  chain: ChainClient;
  docs: ParsedDocument[];
}): Promise<FastifyInstance> => {
  const config = testConfig();
  const logger = silentLogger();
  // A no-op scripted client the verifier holds but the pipeline routes never
  // reach (they run rules-only: no orchestrator on the pipeline deps).
  const anthropic = scriptedAnthropic([]);
  const verifier = createVerifier({
    chain: opts.chain,
    documentParser: stubDocumentParser(opts.docs),
    pinner: localPinner(),
    logger,
    config: {
      threshold: 7_000,
      settleOnAttest: false,
      model: 'claude-opus-4-8',
      maxDocuments: 16,
    },
    orchestrator: {
      anthropic,
      logger,
      model: 'claude-opus-4-8',
      maxTokens: 1_024,
      maxIterations: 10,
      timeoutMs: 60_000,
    },
  });
  const pipelines: PipelineHttpDeps = {
    logger,
    chain: opts.chain,
    documentParser: stubDocumentParser(opts.docs),
    jobStore: createInMemoryPipelineJobStore(),
    config: { threshold: 7_000, maxDocuments: 16, model: 'claude-opus-4-8' },
    // No orchestrator: deterministic rules-only assessment.
  };
  return buildServer({
    config,
    logger,
    verifier,
    jobStore: createInMemoryJobStore(),
    chain: opts.chain,
    pipelines,
  });
};

let app: FastifyInstance | undefined;
afterEach(async () => {
  if (app !== undefined) {
    await app.close();
    app = undefined;
  }
});

describe('GET /pipelines', () => {
  it('lists the registered pipelines', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({ method: 'GET', url: '/pipelines' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((p: { id: string }) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'verification',
        'financing_eligibility',
        'insurance_underwriting',
        'dpp_issuance',
        'compliance_screening',
        'quality_grading',
        'esg_assessment',
        'credit_scoring',
      ]),
    );
  });
});

describe('POST /pipelines/financing-eligibility', () => {
  it('runs the pipeline and persists a job', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/financing-eligibility',
      payload: { batchId: SAMPLE_BATCH, documents: [rawInput], requestedAmount: 500 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.pipelineId).toBe('financing_eligibility');
    expect(body.data.result.eligible).toBe(true);
    expect(body.data.result.approvedAmount).toBe(500);
    expect(body.data.jobId).toMatch(/[0-9a-f-]{36}/);

    const jobRes = await app.inject({
      method: 'GET',
      url: `/pipelines/jobs/${body.data.jobId}`,
    });
    expect(jobRes.statusCode).toBe(200);
    expect(jobRes.json().data.status).toBe('completed');
    expect(jobRes.json().data.pipelineId).toBe('financing_eligibility');
  });

  it('rejects an invalid body with a 400 envelope', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/financing-eligibility',
      payload: { batchId: 'not-hex', documents: [] },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /pipelines/insurance-underwriting', () => {
  it('prices a policy', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/insurance-underwriting',
      payload: {
        batchId: SAMPLE_BATCH,
        documents: [rawInput],
        coverageAmount: 100_000,
        coverageType: 'parametric',
      },
    });
    expect(res.statusCode).toBe(200);
    const r = res.json().data.result;
    expect(r.insurable).toBe(true);
    expect(r.coverageType).toBe('parametric');
    expect(r.premiumRateBps).toBe(250);
  });

  it('requires coverageAmount', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/insurance-underwriting',
      payload: { batchId: SAMPLE_BATCH, documents: [rawInput] },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /pipelines/compliance-screening', () => {
  it('blocks on a denylist hit', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/compliance-screening',
      payload: {
        batchId: SAMPLE_BATCH,
        documents: [rawInput],
        denylist: ['acme'],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.result.status).toBe('blocked');
  });
});

describe('POST /pipelines/dpp-issuance', () => {
  it('issues a passport draft', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/dpp-issuance',
      payload: { batchId: SAMPLE_BATCH, documents: [rawInput] },
    });
    expect(res.statusCode).toBe(200);
    const r = res.json().data.result;
    expect(r.issuable).toBe(true);
    expect(r.passport.batchId).toBe(SAMPLE_BATCH);
  });
});

describe('GET /pipelines/jobs/:id', () => {
  it('404s for an unknown job', async () => {
    app = await buildApp({
      chain: mockChainClient({ provenance: sampleProvenance() }),
      docs: [invoiceDoc()],
    });
    const res = await app.inject({
      method: 'GET',
      url: '/pipelines/jobs/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
