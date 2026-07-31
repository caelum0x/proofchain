/**
 * Unit tests for the domain pipelines (financing, insurance, dpp, compliance,
 * quality, esg, credit). Fully offline: mocked chain + stubbed document parser,
 * no Anthropic client (the deterministic rules-only path) except the explicit
 * tool-composition test which drives a scripted Anthropic loop.
 *
 * The check / scorer / risk registries are reset to the builtin BASELINE before
 * each test so results are deterministic regardless of any domain packs that
 * sibling fill modules may register into the shared registries.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { checkRegistry, registerChecks } from '../src/checks/registry.js';
import { CORE_CHECKS } from '../src/domain/crosscheck.js';
import { scorerRegistry } from '../src/scoring/registry.js';
import { modelScorer, rulesScorer } from '../src/scoring/core.js';
import { riskRegistry } from '../src/risk/registry.js';
import { fraudRiskModel } from '../src/risk/fraud.js';
import { pipelineRegistry } from '../src/pipelines/index.js';
import { runFinancingEligibility } from '../src/pipelines/financing_eligibility.js';
import { runInsuranceUnderwriting } from '../src/pipelines/insurance_underwriting.js';
import { runDppIssuance } from '../src/pipelines/dpp_issuance.js';
import { runComplianceScreening } from '../src/pipelines/compliance_screening.js';
import { runQualityGrading } from '../src/pipelines/quality_grading.js';
import { runEsgAssessment } from '../src/pipelines/esg_assessment.js';
import { runCreditScoring } from '../src/pipelines/credit_scoring.js';
import { TOOL_NAMES } from '../src/anthropic/tools.js';
import type { AssessmentDeps } from '../src/pipelines/assessment.js';
import type { ParsedDocument, ProvenanceData } from '../src/domain/types.js';
import {
  SAMPLE_BATCH,
  invoiceDoc,
  mockChainClient,
  sampleProvenance,
  scriptedAnthropic,
  silentLogger,
  stubDocumentParser,
} from './helpers.js';

const rawInput = {
  name: 'invoice.pdf',
  mimeType: 'application/pdf',
  dataBase64: 'aGVsbG8=',
};

const baseReq = { batchId: SAMPLE_BATCH, documents: [rawInput] };

/** Reset the shared registries to the builtin baseline for determinism. */
beforeEach(() => {
  checkRegistry.reset();
  registerChecks(CORE_CHECKS);
  scorerRegistry.reset();
  scorerRegistry.register(modelScorer);
  scorerRegistry.register(rulesScorer);
  riskRegistry.reset();
  riskRegistry.register(fraudRiskModel);
});

const depsFor = (
  provenance: ProvenanceData,
  docs: ParsedDocument[],
  orchestrator?: AssessmentDeps['orchestrator'],
): AssessmentDeps => ({
  chain: mockChainClient({ provenance }),
  documentParser: stubDocumentParser(docs),
  logger: silentLogger(),
  config: { threshold: 7_000, maxDocuments: 16, model: 'claude-opus-4-8' },
  ...(orchestrator !== undefined ? { orchestrator } : {}),
});

const cleanDeps = () => depsFor(sampleProvenance(), [invoiceDoc()]);
const brokenDeps = () =>
  depsFor(sampleProvenance({ exists: false }), [invoiceDoc()]);

describe('pipeline registry', () => {
  it('registers all seven domain pipelines', () => {
    for (const id of [
      'financing_eligibility',
      'insurance_underwriting',
      'dpp_issuance',
      'compliance_screening',
      'quality_grading',
      'esg_assessment',
      'credit_scoring',
    ]) {
      expect(pipelineRegistry.has(id)).toBe(true);
    }
  });
});

describe('financing_eligibility', () => {
  it('approves a clean batch with a score-scaled advance', async () => {
    const r = await runFinancingEligibility(cleanDeps(), baseReq);
    expect(r.eligible).toBe(true);
    expect(r.score).toBe(10_000);
    expect(r.invoiceValue).toBe(1_000);
    expect(r.advanceRateBps).toBe(9_000);
    expect(r.maxAdvanceAmount).toBe(900);
    expect(r.approvedAmount).toBe(900);
  });

  it('caps the approved amount at the requested amount', async () => {
    const r = await runFinancingEligibility(cleanDeps(), {
      ...baseReq,
      requestedAmount: 500,
    });
    expect(r.approvedAmount).toBe(500);
  });

  it('rejects an unverifiable batch (critical finding)', async () => {
    const r = await runFinancingEligibility(brokenDeps(), baseReq);
    expect(r.eligible).toBe(false);
    expect(r.advanceRateBps).toBe(0);
    expect(r.approvedAmount).toBe(0);
    expect(r.reasons.join(' ')).toMatch(/critical|threshold/);
  });
});

describe('insurance_underwriting', () => {
  it('prices a clean cargo policy', async () => {
    const r = await runInsuranceUnderwriting(cleanDeps(), {
      ...baseReq,
      coverageAmount: 100_000,
    });
    expect(r.insurable).toBe(true);
    expect(r.coverageType).toBe('cargo');
    expect(r.premiumRateBps).toBe(150);
    expect(r.premiumAmount).toBe(1_500);
    expect(r.deductibleBps).toBe(500);
    expect(r.exclusions).toEqual([]);
  });

  it('declines cover when a critical finding is present', async () => {
    const r = await runInsuranceUnderwriting(brokenDeps(), {
      ...baseReq,
      coverageAmount: 100_000,
    });
    expect(r.insurable).toBe(false);
    expect(r.premiumAmount).toBe(0);
  });
});

describe('dpp_issuance', () => {
  it('issues a complete passport for a well-provenanced batch', async () => {
    const r = await runDppIssuance(cleanDeps(), { ...baseReq, productId: 'GTIN-1' });
    expect(r.issuable).toBe(true);
    expect(r.completenessBps).toBe(10_000);
    expect(r.missing).toEqual([]);
    expect(r.passport.productId).toBe('GTIN-1');
    expect(r.passport.checkpointCount).toBe(1);
    expect(r.passport.documentHashes).toHaveLength(1);
  });

  it('flags the missing on-chain batch and refuses issuance', async () => {
    const r = await runDppIssuance(brokenDeps(), baseReq);
    expect(r.issuable).toBe(false);
    expect(r.missing).toContain('on_chain_batch');
    expect(r.completenessBps).toBe(8_333);
  });
});

describe('compliance_screening', () => {
  it('clears a clean batch with no denylist matches', async () => {
    const r = await runComplianceScreening(cleanDeps(), baseReq);
    expect(r.status).toBe('clear');
    expect(r.hits).toEqual([]);
    expect(r.screenedParties).toContain('Acme');
  });

  it('blocks on a denylist match', async () => {
    const r = await runComplianceScreening(cleanDeps(), {
      ...baseReq,
      denylist: ['acme'],
    });
    expect(r.status).toBe('blocked');
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]?.party).toBe('Acme');
  });

  it('routes an unverifiable batch to blocked (critical)', async () => {
    const r = await runComplianceScreening(brokenDeps(), baseReq);
    expect(r.status).toBe('blocked');
  });
});

describe('quality_grading', () => {
  it('grades a clean batch A', async () => {
    const r = await runQualityGrading(cleanDeps(), baseReq);
    expect(r.grade).toBe('A');
    expect(r.gradeScore).toBe(10_000);
    expect(r.defects).toEqual([]);
  });

  it('blends measured metrics into the grade', async () => {
    const r = await runQualityGrading(cleanDeps(), {
      ...baseReq,
      metrics: { defectFree: 0.5 },
    });
    expect(r.metricsScore).toBe(5_000);
    expect(r.gradeScore).toBe(7_500);
    expect(r.grade).toBe('B');
  });

  it('grades an unverifiable batch F', async () => {
    const r = await runQualityGrading(brokenDeps(), baseReq);
    expect(r.grade).toBe('F');
    expect(r.gradeScore).toBe(0);
    expect(r.defects.length).toBeGreaterThan(0);
  });
});

describe('esg_assessment', () => {
  it('scores a clean batch AAA when no factors dampen it', async () => {
    const r = await runEsgAssessment(cleanDeps(), baseReq);
    expect(r.overallScore).toBe(10_000);
    expect(r.rating).toBe('AAA');
    expect(r.governance).toBe(10_000);
  });

  it('uses caller-supplied environmental/social factors', async () => {
    const r = await runEsgAssessment(cleanDeps(), {
      ...baseReq,
      environmental: 0.5,
    });
    expect(r.environmental).toBe(5_000);
    expect(r.overallScore).toBe(8_333);
    expect(r.rating).toBe('AA');
  });
});

describe('credit_scoring', () => {
  it('scores a clean counterparty at the top of the range', async () => {
    const r = await runCreditScoring(cleanDeps(), baseReq);
    expect(r.scoreBps).toBe(10_000);
    expect(r.creditScore).toBe(850);
    expect(r.rating).toBe('AAA');
    expect(r.pdBps).toBe(0);
  });

  it('folds delivery history into the score', async () => {
    const r = await runCreditScoring(cleanDeps(), {
      ...baseReq,
      history: { totalDeliveries: 10, onTimeDeliveries: 5, defaults: 2 },
    });
    expect(r.scoreBps).toBe(8_600);
    expect(r.rating).toBe('AA');
    expect(r.pdBps).toBe(700);
    expect(r.creditScore).toBe(773);
  });
});

describe('tool composition (scripted Anthropic loop)', () => {
  const finalizeScript = (score: number) =>
    scriptedAnthropic([
      {
        stopReason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'p',
            name: TOOL_NAMES.getProvenance,
            input: { batchId: SAMPLE_BATCH },
          },
        ],
      },
      {
        stopReason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'f',
            name: TOOL_NAMES.finalizeVerdict,
            input: { score, summary: 'ok' },
          },
        ],
      },
    ]);

  it('sources the model score from the tool-calling loop', async () => {
    const anthropic = finalizeScript(9_000);
    const deps = depsFor(sampleProvenance(), [invoiceDoc()], {
      anthropic,
      model: 'claude-opus-4-8',
      maxTokens: 1_024,
      maxIterations: 10,
      timeoutMs: 60_000,
    });
    const r = await runFinancingEligibility(deps, baseReq);
    expect(r.score).toBe(9_000);
    // advance = 9000bps * 9000/10000 = 8100
    expect(r.advanceRateBps).toBe(8_100);
    expect(anthropic.createMessage).toHaveBeenCalled();
  });
});
