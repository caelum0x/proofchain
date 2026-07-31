/**
 * Tests for the "risk-scoring" category risk lenses (credit, counterparty,
 * route, esg, liquidity). Offline: no network, no API key. Importing the
 * manifest self-registers every lens into the shared risk registry.
 */
import { describe, expect, it } from 'vitest';
import {
  RISK_MODEL_IDS,
  counterpartyRiskModel,
  creditRiskModel,
  esgRiskModel,
  liquidityRiskModel,
  routeRiskModel,
} from '../src/risk/models.js';
import { assessRisk, riskRegistry } from '../src/risk/index.js';
import { createFinding } from '../src/domain/findings.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { ZERO_ADDRESS } from '../src/risk/util.js';
import type { Finding } from '../src/shared.js';
import type { RiskContext } from '../src/risk/registry.js';
import type { Checkpoint, Hex, ParsedDocument } from '../src/domain/types.js';

const HASH: Hex = `0x${'b'.repeat(64)}`;

const ctx = (over: Partial<RiskContext> = {}): RiskContext => ({
  modelScore: 9_000,
  findings: [],
  documents: [],
  provenance: sampleProvenance(),
  ...over,
});

const checkpoint = (over: Partial<Checkpoint> = {}): Checkpoint => ({
  location: 'X',
  timestamp: 1_700_000_100,
  dataHash: HASH,
  ...over,
});

describe('risk category registration', () => {
  it('registers every lens under a unique id', () => {
    for (const id of RISK_MODEL_IDS) {
      expect(riskRegistry.has(id)).toBe(true);
    }
  });

  it('exposes all lenses via assessRisk', () => {
    const models = assessRisk(ctx()).map((a) => a.model);
    for (const id of RISK_MODEL_IDS) {
      expect(models).toContain(id);
    }
  });

  it('bounds every assessment to [0, 10000] and a matching level', () => {
    const assessed = assessRisk(
      ctx({ findings: [createFinding('X', 'critical', 'bad')] }),
    );
    for (const a of assessed) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(10_000);
      expect(['low', 'medium', 'high', 'critical']).toContain(a.level);
    }
  });
});

describe('credit risk lens', () => {
  it('scores a clean, well-provenanced batch as low risk', () => {
    const r = creditRiskModel.assess(ctx({ documents: [invoiceDoc()] }));
    expect(r.score).toBe(0);
    expect(r.level).toBe('low');
  });

  it('adds an exposure premium for large invoices', () => {
    const big = invoiceDoc({ fields: { total: 250_000 } });
    const r = creditRiskModel.assess(ctx({ documents: [big] }));
    expect(r.score).toBe(1_500);
    expect(r.factors.some((f) => f.startsWith('high_exposure'))).toBe(true);
  });

  it('penalises thin provenance and a sub-threshold model score', () => {
    const r = creditRiskModel.assess(
      ctx({
        modelScore: 4_000,
        provenance: sampleProvenance({ checkpoints: [] }),
      }),
    );
    // 800 (thin) + 1200 (sub-threshold model)
    expect(r.score).toBe(2_000);
  });

  it('weights finding severity into the score', () => {
    const r = creditRiskModel.assess(
      ctx({ findings: [createFinding('H', 'high', 'x')] }),
    );
    expect(r.score).toBe(2_500);
    expect(r.factors).toContain('H (high)');
  });
});

describe('counterparty risk lens', () => {
  it('flags an unset on-chain supplier', () => {
    const r = counterpartyRiskModel.assess(
      ctx({
        documents: [invoiceDoc()],
        provenance: sampleProvenance({ supplier: ZERO_ADDRESS }),
      }),
    );
    expect(r.factors).toContain('unknown_onchain_supplier');
    expect(r.score).toBeGreaterThanOrEqual(4_000);
  });

  it('flags disagreeing party names', () => {
    const r = counterpartyRiskModel.assess(
      ctx({
        documents: [invoiceDoc()],
        findings: [createFinding('SUPPLIER_MISMATCH', 'high', 'x')],
      }),
    );
    expect(r.factors.some((f) => f.startsWith('supplier_name_mismatch'))).toBe(
      true,
    );
  });

  it('flags documents that name no party', () => {
    const anon = invoiceDoc({ fields: { total: 100 } });
    const r = counterpartyRiskModel.assess(ctx({ documents: [anon] }));
    expect(r.factors).toContain('no_named_party');
  });

  it('is low risk for a known supplier with a named party', () => {
    const r = counterpartyRiskModel.assess(ctx({ documents: [invoiceDoc()] }));
    expect(r.score).toBe(0);
    expect(r.level).toBe('low');
  });
});

describe('route risk lens', () => {
  it('is high risk with no checkpoints', () => {
    const r = routeRiskModel.assess(
      ctx({ provenance: sampleProvenance({ checkpoints: [] }) }),
    );
    expect(r.score).toBe(4_000);
    expect(r.factors).toContain('no_route_visibility');
  });

  it('flags a single checkpoint as no movement proof', () => {
    const r = routeRiskModel.assess(ctx());
    expect(r.score).toBe(1_500);
    expect(r.factors).toContain('single_checkpoint_no_movement');
  });

  it('flags non-monotonic checkpoint timestamps', () => {
    const r = routeRiskModel.assess(
      ctx({
        provenance: sampleProvenance({
          checkpoints: [
            checkpoint({ timestamp: 200 }),
            checkpoint({ timestamp: 100 }),
          ],
        }),
      }),
    );
    expect(r.factors).toContain('non_monotonic_checkpoints');
    expect(r.score).toBe(3_000);
  });

  it('flags implausibly long dwell gaps', () => {
    const day = 24 * 60 * 60;
    const r = routeRiskModel.assess(
      ctx({
        provenance: sampleProvenance({
          checkpoints: [
            checkpoint({ timestamp: 0 }),
            checkpoint({ timestamp: 40 * day }),
          ],
        }),
      }),
    );
    expect(r.factors.some((f) => f.startsWith('long_dwell_gaps'))).toBe(true);
    expect(r.score).toBe(1_200);
  });
});

describe('esg risk lens', () => {
  it('is low risk with disclosure and a trail', () => {
    const r = esgRiskModel.assess(
      ctx({
        provenance: sampleProvenance({
          checkpoints: [checkpoint(), checkpoint({ timestamp: 1_700_000_200 })],
        }),
      }),
    );
    expect(r.score).toBe(0);
  });

  it('penalises missing disclosure and sparse traceability', () => {
    const r = esgRiskModel.assess(
      ctx({ provenance: sampleProvenance({ metadataURI: '   ' }) }),
    );
    // 2000 (no disclosure) + 1500 (sparse: single checkpoint)
    expect(r.score).toBe(3_500);
    expect(r.factors).toContain('no_esg_disclosure');
    expect(r.factors).toContain('sparse_traceability');
  });

  it('penalises an origin-hash governance break', () => {
    const r = esgRiskModel.assess(
      ctx({
        provenance: sampleProvenance({
          checkpoints: [checkpoint(), checkpoint({ timestamp: 1_700_000_200 })],
        }),
        findings: [createFinding('ORIGIN_HASH_MISMATCH', 'critical', 'x')],
      }),
    );
    // 3000 governance + 2000 critical
    expect(r.score).toBe(5_000);
    expect(r.level).toBe('high');
  });
});

describe('liquidity risk lens', () => {
  it('is low risk for a passing, valued shipment', () => {
    const r = liquidityRiskModel.assess(ctx({ documents: [invoiceDoc()] }));
    expect(r.score).toBe(0);
  });

  it('rises as the model score falls below the pass threshold', () => {
    const r = liquidityRiskModel.assess(
      ctx({ modelScore: 5_000, documents: [invoiceDoc()] }),
    );
    // gap = 7000 - 5000 = 2000, factor 0.6 → 1200
    expect(r.score).toBe(1_200);
    expect(r.factors.some((f) => f.startsWith('below_pass_threshold'))).toBe(
      true,
    );
  });

  it('adds blocking-finding weight', () => {
    const r = liquidityRiskModel.assess(
      ctx({
        documents: [invoiceDoc()],
        findings: [
          createFinding('H', 'high', 'x'),
          createFinding('L', 'low', 'x'), // non-blocking, ignored
        ],
      }),
    );
    expect(r.score).toBe(2_500);
    expect(r.factors).toContain('H (high)');
    expect(r.factors).not.toContain('L (low)');
  });

  it('flags an unvaluable shipment (no invoice total)', () => {
    const noTotal: ParsedDocument = invoiceDoc({ fields: { currency: 'USD' } });
    const r = liquidityRiskModel.assess(ctx({ documents: [noTotal] }));
    expect(r.factors).toContain('unvaluable_no_invoice_total');
    expect(r.score).toBe(1_500);
  });
});
