import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { loadConfig, type AppConfig } from '../src/config/env.js';
import { createInMemoryJobStore } from '../src/jobs/store.js';
import { createVerifier } from '../src/verifier.js';
import { TOOL_NAMES } from '../src/anthropic/tools.js';
import {
  SAMPLE_BATCH,
  invoiceDoc,
  localPinner,
  mockChainClient,
  sampleProvenance,
  scriptedAnthropic,
  silentLogger,
  stubDocumentParser,
  toolUseMessage,
} from './helpers.js';
import type { ChainClient } from '../src/chain/client.js';
import type { ParsedDocument, OnchainAttestation, Hex } from '../src/domain/types.js';

const testConfig = (): AppConfig =>
  loadConfig({
    ANTHROPIC_API_KEY: 'test-key',
    AGENT_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    BASE_SEPOLIA_RPC_URL: 'http://localhost:8545',
    NODE_ENV: 'test',
  });

const finalizeScript = (score: number) =>
  scriptedAnthropic([
    toolUseMessage({
      id: 'p',
      name: TOOL_NAMES.getProvenance,
      input: { batchId: SAMPLE_BATCH },
    }),
    toolUseMessage({
      id: 'd',
      name: TOOL_NAMES.parseDocument,
      input: { index: 0 },
    }),
    toolUseMessage({
      id: 'f',
      name: TOOL_NAMES.finalizeVerdict,
      input: { score, summary: 'ok' },
    }),
  ]);

const buildApp = (opts: {
  chain: ChainClient;
  docs: ParsedDocument[];
  modelScore: number;
  settleOnAttest?: boolean;
}): FastifyInstance | Promise<FastifyInstance> => {
  const config = testConfig();
  const logger = silentLogger();
  const anthropic = finalizeScript(opts.modelScore);
  const verifier = createVerifier({
    chain: opts.chain,
    documentParser: stubDocumentParser(opts.docs),
    pinner: localPinner(),
    logger,
    config: {
      threshold: 7_000,
      settleOnAttest: opts.settleOnAttest ?? false,
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
  return buildServer({
    config,
    logger,
    verifier,
    jobStore: createInMemoryJobStore(),
    chain: opts.chain,
  });
};

const verifyPayload = {
  batchId: SAMPLE_BATCH,
  documents: [
    { name: 'invoice.pdf', mimeType: 'application/pdf', dataBase64: 'aGVsbG8=' },
  ],
};

let app: FastifyInstance | undefined;
afterEach(async () => {
  if (app !== undefined) {
    await app.close();
    app = undefined;
  }
});

describe('POST /verify (mocked Anthropic + mocked chain)', () => {
  it('runs the pipeline and returns a reconciled verdict + tx hash', async () => {
    const chain = mockChainClient({ provenance: sampleProvenance() });
    app = await buildApp({ chain, docs: [invoiceDoc()], modelScore: 9_800 });

    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: verifyPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.verdict.batchId).toBe(SAMPLE_BATCH);
    // clean invoice → no rule findings → model score 9800 stands
    expect(body.data.verdict.score).toBe(9_800);
    expect(body.data.verdict.passed).toBe(true);
    expect(body.data.verdict.verdictURI).toBe('ipfs://mock/test');
    expect(body.data.txHash).toMatch(/^0x/);
    expect(body.data.alreadyAttested).toBe(false);
    expect(body.data.jobId).toMatch(/[0-9a-f-]{36}/);
    expect(chain.attest).toHaveBeenCalledOnce();
  });

  it('DETERMINISTIC GUARD: rule findings override a too-generous model score', async () => {
    // invoice whose line items (1000) contradict the stated total (5000)
    const badInvoice = invoiceDoc({
      fields: {
        total: 5_000,
        lineItems: [
          { description: 'w', quantity: 10, unitPrice: 100, amount: 1_000 },
        ],
      },
    });
    const chain = mockChainClient({ provenance: sampleProvenance() });
    app = await buildApp({ chain, docs: [badInvoice], modelScore: 9_800 });

    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: verifyPayload,
    });

    const body = res.json();
    // INVOICE_TOTAL_MISMATCH (high) → rule score 7000; min(9800, 7000) = 7000
    expect(body.data.verdict.score).toBe(7_000);
    expect(body.data.verdict.passed).toBe(true);
    const codes = body.data.verdict.findings.map((f: { code: string }) => f.code);
    expect(codes).toContain('INVOICE_TOTAL_MISMATCH');
    // attested with the RECONCILED score, not the model's
    expect(chain.attest).toHaveBeenCalledWith(
      expect.objectContaining({ score: 7_000 }),
    );
  });

  it('is idempotent: an already-attested batch returns the existing verdict', async () => {
    const attestation: OnchainAttestation = {
      batchId: SAMPLE_BATCH,
      score: 8_800,
      verdictHash: `0x${'2'.repeat(64)}` as Hex,
      verdictURI: 'ipfs://existing',
      attestedAt: 1_700_000_500,
      agent: `0x${'0'.repeat(38)}a9` as Hex,
      exists: true,
    };
    const chain = mockChainClient({ isAttested: true, attestation });
    app = await buildApp({ chain, docs: [invoiceDoc()], modelScore: 9_000 });

    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: verifyPayload,
    });

    const body = res.json();
    expect(body.data.alreadyAttested).toBe(true);
    expect(body.data.verdict.score).toBe(8_800);
    expect(body.data.verdict.verdictURI).toBe('ipfs://existing');
    expect(chain.attest).not.toHaveBeenCalled();
  });

  it('settles when settleOnAttest is enabled', async () => {
    const chain = mockChainClient({ provenance: sampleProvenance() });
    app = await buildApp({
      chain,
      docs: [invoiceDoc()],
      modelScore: 9_500,
      settleOnAttest: true,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: verifyPayload,
    });
    expect(res.json().data.settleTxHash).toMatch(/^0x/);
    expect(chain.settle).toHaveBeenCalledOnce();
  });

  it('records the job and exposes it via GET /jobs/:id', async () => {
    const chain = mockChainClient();
    app = await buildApp({ chain, docs: [invoiceDoc()], modelScore: 9_000 });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: verifyPayload,
    });
    const { jobId } = verifyRes.json().data;

    const jobRes = await app.inject({ method: 'GET', url: `/jobs/${jobId}` });
    expect(jobRes.statusCode).toBe(200);
    expect(jobRes.json().data.status).toBe('completed');
  });
});

describe('GET /health', () => {
  it('reports ok when the chain is reachable', async () => {
    const chain = mockChainClient();
    app = await buildApp({ chain, docs: [invoiceDoc()], modelScore: 9_000 });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('ok');
    expect(res.json().data.chainId).toBe(84_532);
  });

  it('reports degraded (503) when the chain read fails', async () => {
    const chain = mockChainClient();
    (chain.isAttested as unknown as { mockRejectedValueOnce: (e: Error) => void })
      .mockRejectedValueOnce(new Error('rpc down'));
    app = await buildApp({ chain, docs: [invoiceDoc()], modelScore: 9_000 });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json().data.status).toBe('degraded');
  });
});
