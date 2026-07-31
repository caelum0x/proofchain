import { describe, expect, it } from 'vitest';
import {
  pipelineRegistry,
  runVerificationPipeline,
} from '../src/pipelines/index.js';
import { TOOL_NAMES } from '../src/anthropic/tools.js';
import type { VerifierDeps, VerifyResult } from '../src/verifier.js';
import type { OnchainAttestation, Hex } from '../src/domain/types.js';
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

const finalizeScript = (score: number) =>
  scriptedAnthropic([
    { stopReason: 'tool_use', content: [{ type: 'tool_use', id: 'p', name: TOOL_NAMES.getProvenance, input: { batchId: SAMPLE_BATCH } }] },
    { stopReason: 'tool_use', content: [{ type: 'tool_use', id: 'd', name: TOOL_NAMES.parseDocument, input: { index: 0 } }] },
    { stopReason: 'tool_use', content: [{ type: 'tool_use', id: 'f', name: TOOL_NAMES.finalizeVerdict, input: { score, summary: 'ok' } }] },
  ]);

const deps = (chain: ReturnType<typeof mockChainClient>, modelScore: number): VerifierDeps => {
  const logger = silentLogger();
  return {
    chain,
    documentParser: stubDocumentParser([invoiceDoc()]),
    pinner: localPinner(),
    logger,
    config: {
      threshold: 7_000,
      settleOnAttest: false,
      model: 'claude-opus-4-8',
      maxDocuments: 16,
    },
    orchestrator: {
      anthropic: finalizeScript(modelScore),
      logger,
      model: 'claude-opus-4-8',
      maxTokens: 1_024,
      maxIterations: 10,
      timeoutMs: 60_000,
    },
  };
};

const req = {
  batchId: SAMPLE_BATCH,
  documents: [
    { name: 'invoice.pdf', mimeType: 'application/pdf', dataBase64: 'aGVsbG8=' },
  ],
};

describe('verification pipeline (registry)', () => {
  it('is registered under the "verification" id', () => {
    expect(pipelineRegistry.has('verification')).toBe(true);
    expect(pipelineRegistry.require('verification').description).toContain(
      'verification',
    );
  });

  it('runs end-to-end and attaches advisory risk', async () => {
    const chain = mockChainClient({ provenance: sampleProvenance() });
    const result = await runVerificationPipeline(deps(chain, 9_500), req);
    expect(result.verdict.score).toBe(9_500);
    expect(result.verdict.passed).toBe(true);
    expect(result.alreadyAttested).toBe(false);
    expect(result.risk?.map((r) => r.model)).toContain('fraud');
    expect(result.risk?.find((r) => r.model === 'fraud')?.level).toBe('low');
    expect(chain.attest).toHaveBeenCalledOnce();
  });

  it('is discoverable and runnable via the registry', async () => {
    const chain = mockChainClient({ provenance: sampleProvenance() });
    const pipeline = pipelineRegistry.require('verification');
    const result = (await pipeline.run(deps(chain, 9_000), req)) as VerifyResult;
    expect(result.verdict.passed).toBe(true);
  });

  it('short-circuits (no risk) when already attested', async () => {
    const attestation: OnchainAttestation = {
      batchId: SAMPLE_BATCH,
      score: 8_800,
      verdictHash: `0x${'2'.repeat(64)}` as Hex,
      verdictURI: 'ipfs://existing',
      attestedAt: 1_700_000_500,
      agent: `0x${'0'.repeat(38)}a9` as Hex,
      exists: true,
    };
    const chain = mockChainClient({ attestation });
    const result = await runVerificationPipeline(deps(chain, 9_000), req);
    expect(result.alreadyAttested).toBe(true);
    expect(result.risk).toBeUndefined();
    expect(chain.attest).not.toHaveBeenCalled();
  });
});
