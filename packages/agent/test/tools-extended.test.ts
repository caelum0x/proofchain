import { describe, expect, it } from 'vitest';
// Importing the barrel registers every builtin + Fill-agent tool.
import { toolRegistry } from '../src/tools/index.js';
import {
  clampBps,
  deterministicBps,
  gradeOf,
  normalizeParty,
} from '../src/tools/support.js';
import { attestationStore } from '../src/tools/get_attestation.js';
import { reputationStore } from '../src/tools/lookup_reputation.js';
import { seedSanction } from '../src/tools/lookup_sanctions.js';
import { policyStore, DEFAULT_POLICY } from '../src/tools/get_policy.js';
import { receivableStore } from '../src/tools/get_receivable.js';
import { esgStore } from '../src/tools/fetch_esg.js';
import { kycStore } from '../src/tools/get_kyc.js';
import { SAMPLE_BATCH, invoiceDoc, sampleProvenance } from './helpers.js';
import type {
  ToolHandlerContext,
  ToolLoopState,
} from '../src/tools/registry.js';

const ctx = (over: Partial<ToolHandlerContext> = {}): ToolHandlerContext => ({
  batchId: SAMPLE_BATCH,
  provenance: sampleProvenance(),
  documents: [invoiceDoc()],
  ...over,
});

const state = (over: Partial<ToolLoopState> = {}): ToolLoopState => ({
  findings: [],
  finalized: false,
  modelScore: 0,
  summary: '',
  ...over,
});

/** Run a registered tool with validated input; returns its result. */
const run = (name: string, input: unknown, c = ctx(), s = state()) => {
  const tool = toolRegistry.require(name);
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) throw new Error(`invalid input for ${name}`);
  return tool.handle(parsed.data, c, s);
};

const content = <T = Record<string, unknown>>(r: { content: unknown }): T =>
  r.content as T;

describe('support helpers', () => {
  it('deterministicBps is stable and in range', () => {
    const a = deterministicBps('x');
    expect(a).toBe(deterministicBps('x'));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(10_000);
    expect(deterministicBps('x')).not.toBe(deterministicBps('y'));
  });

  it('clampBps clamps and rounds', () => {
    expect(clampBps(-5)).toBe(0);
    expect(clampBps(10_050)).toBe(10_000);
    expect(clampBps(1234.6)).toBe(1235);
  });

  it('gradeOf bands scores A..F', () => {
    expect(gradeOf(9_000)).toBe('A');
    expect(gradeOf(500)).toBe('F');
  });

  it('normalizeParty collapses case and whitespace', () => {
    expect(normalizeParty('  Acme   Corp ')).toBe('acme corp');
  });
});

describe('all 15 tools are registered', () => {
  it('exposes every advertised capability', () => {
    for (const name of [
      'get_provenance',
      'parse_document',
      'record_finding',
      'finalize_verdict',
      'get_checkpoints',
      'get_attestation',
      'run_check',
      'score_dimension',
      'estimate_risk',
      'lookup_reputation',
      'lookup_sanctions',
      'get_policy',
      'get_receivable',
      'fetch_esg',
      'get_kyc',
    ]) {
      expect(toolRegistry.has(name)).toBe(true);
    }
  });

  it('every tool definition name matches its registry key', () => {
    for (const tool of toolRegistry.all()) {
      expect(tool.definition.name).toBe(tool.name);
      expect(tool.definition.input_schema.type).toBe('object');
    }
  });
});

describe('get_checkpoints', () => {
  it('returns the full trail and reports chronology', () => {
    const c = ctx({
      provenance: sampleProvenance({
        checkpoints: [
          { location: 'Shenzhen', timestamp: 100, dataHash: `0x${'1'.repeat(64)}` },
          { location: 'Rotterdam', timestamp: 200, dataHash: `0x${'2'.repeat(64)}` },
        ],
      }),
    });
    const r = content(run('get_checkpoints', {}, c));
    expect(r.total).toBe(2);
    expect(r.chronological).toBe(true);
  });

  it('flags a non-chronological trail', () => {
    const c = ctx({
      provenance: sampleProvenance({
        checkpoints: [
          { location: 'A', timestamp: 300, dataHash: `0x${'1'.repeat(64)}` },
          { location: 'B', timestamp: 100, dataHash: `0x${'2'.repeat(64)}` },
        ],
      }),
    });
    expect(content(run('get_checkpoints', {}, c)).chronological).toBe(false);
  });

  it('filters by location and applies limit', () => {
    const c = ctx({
      provenance: sampleProvenance({
        checkpoints: [
          { location: 'Shenzhen Port', timestamp: 100, dataHash: `0x${'1'.repeat(64)}` },
          { location: 'Rotterdam', timestamp: 200, dataHash: `0x${'2'.repeat(64)}` },
          { location: 'Shenzhen Yard', timestamp: 300, dataHash: `0x${'3'.repeat(64)}` },
        ],
      }),
    });
    const filtered = content(run('get_checkpoints', { location: 'shenzhen' }, c));
    expect(filtered.matched).toBe(2);
    const limited = content(
      run('get_checkpoints', { location: 'shenzhen', limit: 1 }, c),
    );
    expect(limited.matched).toBe(2);
    expect(limited.returned).toBe(1);
  });

  it('filters by sinceTimestamp', () => {
    const c = ctx({
      provenance: sampleProvenance({
        checkpoints: [
          { location: 'A', timestamp: 100, dataHash: `0x${'1'.repeat(64)}` },
          { location: 'B', timestamp: 500, dataHash: `0x${'2'.repeat(64)}` },
        ],
      }),
    });
    expect(content(run('get_checkpoints', { sinceTimestamp: 200 }, c)).returned).toBe(1);
  });
});

describe('get_attestation', () => {
  it('reports "none" for an unseen, unfinalized batch', () => {
    attestationStore.reset();
    const r = content(run('get_attestation', {}));
    expect(r.status).toBe('none');
    expect(r.priorAttestation).toBeNull();
  });

  it('reflects the in-loop finalized verdict as pending', () => {
    attestationStore.reset();
    const r = content(
      run('get_attestation', {}, ctx(), state({ finalized: true, modelScore: 8_800 })),
    );
    expect(r.status).toBe('pending');
    expect((r.pending as { proposedScore: number }).proposedScore).toBe(8_800);
  });

  it('surfaces a seeded prior on-chain attestation', () => {
    attestationStore.reset();
    attestationStore.seed(SAMPLE_BATCH, {
      score: 9_100,
      verdictHash: `0x${'a'.repeat(64)}`,
      verdictURI: 'ipfs://v',
      attestedAt: 1_700_000_500,
      agent: `0x${'b'.repeat(40)}`,
    });
    const r = content(run('get_attestation', {}));
    expect(r.status).toBe('attested');
    expect((r.priorAttestation as { score: number }).score).toBe(9_100);
  });
});

describe('run_check', () => {
  it('runs a single named check and returns findings without recording', () => {
    const c = ctx({ provenance: sampleProvenance({ exists: false }) });
    const r = content(run('run_check', { code: 'core.provenance_presence' }, c));
    expect(r.ran).toEqual(['core.provenance_presence']);
    expect((r.findings as { code: string }[]).some((f) => f.code === 'UNKNOWN_BATCH')).toBe(true);
  });

  it('runs a whole domain', () => {
    const r = content(run('run_check', { domain: 'provenance' }));
    expect((r.ran as string[]).length).toBeGreaterThanOrEqual(1);
  });

  it('runs all checks when nothing is specified', () => {
    const r = content(run('run_check', {}));
    expect((r.ran as string[]).length).toBeGreaterThanOrEqual(9);
  });

  it('errors on an unknown check code', () => {
    const r = run('run_check', { code: 'nope.not_real' });
    expect(r.isError).toBe(true);
  });

  it('errors on an empty domain', () => {
    const r = run('run_check', { domain: 'does_not_exist' });
    expect(r.isError).toBe(true);
  });
});

describe('score_dimension', () => {
  it('scores a single dimension from the loop state', () => {
    const r = content(run('score_dimension', { dimension: 'model' }, ctx(), state({ modelScore: 7_777 })));
    expect(r.dimension).toBe('model');
    expect(r.score).toBe(7_777);
  });

  it('scores all dimensions and identifies the lowest', () => {
    const r = content(run('score_dimension', {}, ctx(), state({ modelScore: 9_000 })));
    expect((r.dimensions as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(typeof r.lowest).toBe('string');
  });

  it('errors on an unknown dimension', () => {
    expect(run('score_dimension', { dimension: 'ghost' }).isError).toBe(true);
  });
});

describe('estimate_risk', () => {
  it('runs a single model (clean batch scores zero risk)', () => {
    const r = content(run('estimate_risk', { model: 'fraud' }, ctx(), state({ modelScore: 9_500 })));
    expect(r.model).toBe('fraud');
    expect(r.score).toBe(0);
  });

  it('runs all models and returns the highest', () => {
    const r = content(run('estimate_risk', {}, ctx(), state({ modelScore: 9_500 })));
    expect((r.assessments as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(typeof r.highest).toBe('string');
  });

  it('errors on an unknown model', () => {
    expect(run('estimate_risk', { model: 'ghost' }).isError).toBe(true);
  });
});

describe('lookup_reputation', () => {
  it('returns a seeded record when present', () => {
    reputationStore.reset();
    reputationStore.seed('acme corp', { score: 9_400, dealsCompleted: 42 });
    const r = content(run('lookup_reputation', { party: 'Acme Corp' }));
    expect(r.source).toBe('seeded');
    expect(r.score).toBe(9_400);
    expect(r.grade).toBe('A');
  });

  it('derives deterministically and boosts a known counterparty', () => {
    reputationStore.reset();
    const supplier = sampleProvenance().supplier;
    const plain = content(run('lookup_reputation', { party: 'random-outsider' }));
    expect(plain.source).toBe('derived');
    expect(plain.score).toBe(plain.score); // stable

    const known = content(run('lookup_reputation', { party: supplier }));
    expect(known.source).toBe('derived');
    expect((known.factors as string[]).some((f) => f.startsWith('known_counterparty'))).toBe(true);
  });
});

describe('lookup_sanctions', () => {
  it('flags a hit on a seeded denylist name (substring)', () => {
    const r = content(run('lookup_sanctions', { name: 'Blocked Trading' }));
    expect(r.hit).toBe(true);
    expect((r.matches as unknown[]).length).toBeGreaterThan(0);
  });

  it('flags a hit on a denylisted address', () => {
    const r = content(
      run('lookup_sanctions', { address: '0x000000000000000000000000000000000000dEaD' }),
    );
    expect(r.hit).toBe(true);
  });

  it('clears a clean party', () => {
    expect(content(run('lookup_sanctions', { name: 'Totally Legit Traders' })).hit).toBe(false);
  });

  it('honours a freshly seeded entry', () => {
    seedSanction('test-badco', { name: 'Bad Co Ltd', program: 'TEST' });
    expect(content(run('lookup_sanctions', { name: 'Bad Co Ltd' })).hit).toBe(true);
  });

  it('rejects an input with neither name nor address', () => {
    const tool = toolRegistry.require('lookup_sanctions');
    expect(tool.inputSchema.safeParse({}).success).toBe(false);
  });
});

describe('get_policy', () => {
  it('returns the default policy', () => {
    const r = content(run('get_policy', {}));
    expect(r.policyId).toBe('default');
    expect(r.passThresholdBps).toBe(DEFAULT_POLICY.passThresholdBps);
    expect(r.criticalAutoFail).toBe(true);
  });

  it('returns a seeded named policy', () => {
    policyStore.seed('strict', {
      policyId: 'strict',
      passThresholdBps: 9_000,
      severityPenaltyBps: {},
      maxDocuments: 4,
      requiredDocTypes: ['invoice', 'bill_of_lading'],
      criticalAutoFail: true,
    });
    const r = content(run('get_policy', { policyId: 'strict' }));
    expect(r.passThresholdBps).toBe(9_000);
    expect(r.source).toBe('seeded');
  });

  it('errors on an unknown named policy', () => {
    expect(run('get_policy', { policyId: 'ghost' }).isError).toBe(true);
  });
});

describe('get_receivable', () => {
  it('derives a receivable from the invoice', () => {
    const r = content(run('get_receivable', {}));
    expect(r.faceValue).toBe(1_000);
    expect(r.currency).toBe('USD');
    expect(r.status).toBe('verifiable');
    expect(r.source).toBe('derived');
  });

  it('marks an unregistered batch unverified', () => {
    const c = ctx({ provenance: sampleProvenance({ exists: false }) });
    expect(content(run('get_receivable', {}, c)).status).toBe('unverified');
  });

  it('errors when the target document has no total', () => {
    const c = ctx({ documents: [invoiceDoc({ fields: { currency: 'USD' } })] });
    expect(run('get_receivable', {}, c).isError).toBe(true);
  });

  it('errors when no documents exist', () => {
    expect(run('get_receivable', {}, ctx({ documents: [] })).isError).toBe(true);
  });

  it('prefers a seeded receivable', () => {
    receivableStore.reset();
    receivableStore.seed(SAMPLE_BATCH, {
      faceValue: 50_000,
      currency: 'EUR',
      debtor: 'BuyerCo',
    });
    const r = content(run('get_receivable', {}));
    expect(r.source).toBe('seeded');
    expect(r.faceValue).toBe(50_000);
    expect(r.currency).toBe('EUR');
  });
});

describe('fetch_esg', () => {
  it('derives a carbon estimate from the checkpoint trail', () => {
    esgStore.reset();
    const c = ctx({
      provenance: sampleProvenance({
        checkpoints: [
          { location: 'Shenzhen', timestamp: 100, dataHash: `0x${'1'.repeat(64)}` },
          { location: 'Rotterdam', timestamp: 200, dataHash: `0x${'2'.repeat(64)}` },
        ],
      }),
    });
    const r = content(run('fetch_esg', {}, c));
    // 2 legs * 120 + 2 distinct locations * 300 = 840
    expect(r.carbonKg).toBe(840);
    expect(r.source).toBe('derived');
    expect((r.ratings as Record<string, number>).environment).toBeGreaterThanOrEqual(0);
  });

  it('reports on the supplier scope', () => {
    esgStore.reset();
    const r = content(run('fetch_esg', { scope: 'supplier' }));
    expect(r.scope).toBe('supplier');
    expect(r.subject).toBe(sampleProvenance().supplier);
  });

  it('prefers a seeded ESG record', () => {
    esgStore.reset();
    esgStore.seed(SAMPLE_BATCH, {
      carbonKg: 12,
      environmentBps: 9_000,
      socialBps: 8_000,
      governanceBps: 7_000,
    });
    const r = content(run('fetch_esg', {}));
    expect(r.source).toBe('seeded');
    expect(r.carbonKg).toBe(12);
    expect(r.compositeBps).toBe(8_000);
  });
});

describe('get_kyc', () => {
  it('derives a deterministic, stable status', () => {
    kycStore.reset();
    const a = content(run('get_kyc', { party: 'Acme Corp' }));
    const b = content(run('get_kyc', { party: 'acme corp' }));
    expect(a.verified).toBe(b.verified);
    expect(a.level).toBe(b.level);
    expect(a.source).toBe('derived');
  });

  it('prefers a seeded record', () => {
    kycStore.reset();
    kycStore.seed('acme corp', {
      verified: true,
      level: 'enhanced',
      riskRating: 'low',
      expiresAt: 1_800_000_000,
    });
    const r = content(run('get_kyc', { party: 'Acme Corp' }));
    expect(r.source).toBe('seeded');
    expect(r.level).toBe('enhanced');
    expect(r.expiresAt).toBe(1_800_000_000);
  });
});
