/**
 * Tests for the "risk-scoring" category scoring dimensions (authenticity,
 * consistency, compliance, completeness, esg, risk) and the `reconciled`
 * reconciler. Offline: no network, no API key.
 *
 * Importing `scoring/index.js` registers the builtin `model`+`rules` dimensions
 * into THIS test file's isolated registry; `scoring/dimensions.js` adds the
 * extended dimensions. Vitest isolates module state per file, so this does not
 * affect the foundation's `scoring-registry.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { reconcile, scorerRegistry } from '../src/scoring/index.js';
import {
  EXTENDED_DIMENSIONS,
  authenticityScorer,
  complianceScorer,
  completenessScorer,
  consistencyScorer,
  esgScorer,
  reconcilerScorer,
  riskScorer,
} from '../src/scoring/dimensions.js';
import { createFinding } from '../src/domain/findings.js';
import { AppError } from '../src/errors.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import type { Finding } from '../src/shared.js';
import type { ScoringContext } from '../src/scoring/registry.js';
import type { Checkpoint, Hex, ParsedDocument } from '../src/domain/types.js';

const zeroHash: Hex = `0x${'0'.repeat(64)}`;

const ctx = (over: Partial<ScoringContext> = {}): ScoringContext => ({
  modelScore: 9_600,
  findings: [],
  documents: [invoiceDoc()],
  provenance: sampleProvenance(),
  ...over,
});

const f = (code: string, severity: Finding['severity']): Finding =>
  createFinding(code, severity, 'x');

const secondCheckpoint: Checkpoint = {
  location: 'Y',
  timestamp: 1_700_000_200,
  dataHash: `0x${'c'.repeat(64)}`,
};

describe('scoring category registration', () => {
  it('registers every extended dimension under a unique id', () => {
    for (const dim of EXTENDED_DIMENSIONS) {
      expect(scorerRegistry.has(dim)).toBe(true);
    }
  });
});

describe('authenticity dimension', () => {
  it('is clean with no authenticity findings', () => {
    expect(authenticityScorer.score(ctx()).score).toBe(10_000);
  });
  it('hard-fails on an origin-hash mismatch', () => {
    const s = authenticityScorer.score(
      ctx({ findings: [f('ORIGIN_HASH_MISMATCH', 'critical')] }),
    );
    expect(s.score).toBe(0);
  });
  it('deducts for a missing document set', () => {
    expect(
      authenticityScorer.score(ctx({ findings: [f('NO_DOCUMENTS', 'high')] }))
        .score,
    ).toBe(7_000);
  });
  it('ignores non-authenticity findings', () => {
    expect(
      authenticityScorer.score(
        ctx({ findings: [f('INVOICE_TOTAL_MISMATCH', 'high')] }),
      ).score,
    ).toBe(10_000);
  });
});

describe('consistency dimension', () => {
  it('deducts for a total mismatch', () => {
    expect(
      consistencyScorer.score(ctx({ findings: [f('INVOICE_TOTAL_MISMATCH', 'high')] }))
        .score,
    ).toBe(7_000);
  });
  it('hard-fails on any critical finding', () => {
    expect(
      consistencyScorer.score(ctx({ findings: [f('ORIGIN_HASH_MISMATCH', 'critical')] }))
        .score,
    ).toBe(0);
  });
  it('is clean otherwise', () => {
    expect(consistencyScorer.score(ctx()).score).toBe(10_000);
  });
});

describe('compliance dimension', () => {
  it('is clean when no compliance findings are present', () => {
    expect(complianceScorer.score(ctx()).score).toBe(10_000);
  });
  it('deducts for a customs hold', () => {
    expect(
      complianceScorer.score(ctx({ findings: [f('CUSTOMS_HOLD', 'medium')] })).score,
    ).toBe(9_000);
  });
  it('hard-fails on a sanctions hit', () => {
    expect(
      complianceScorer.score(ctx({ findings: [f('SANCTIONS_HIT', 'critical')] })).score,
    ).toBe(0);
  });
  it('ignores unrelated trade findings', () => {
    expect(
      complianceScorer.score(ctx({ findings: [f('QUANTITY_MISMATCH', 'high')] })).score,
    ).toBe(10_000);
  });
});

describe('completeness dimension', () => {
  it('is clean for a complete package', () => {
    expect(completenessScorer.score(ctx()).score).toBe(10_000);
  });
  it('is a hard zero with no documents', () => {
    expect(completenessScorer.score(ctx({ documents: [] })).score).toBe(0);
  });
  it('deducts for an unregistered batch with no trail', () => {
    const s = completenessScorer.score(
      ctx({ provenance: sampleProvenance({ exists: false, checkpoints: [] }) }),
    );
    expect(s.score).toBe(4_000);
  });
  it('deducts for an invoice missing required fields', () => {
    const bare: ParsedDocument = invoiceDoc({ fields: { currency: 'USD' } });
    expect(completenessScorer.score(ctx({ documents: [bare] })).score).toBe(8_500);
  });
});

describe('esg dimension', () => {
  it('is clean with disclosure and a trail', () => {
    const s = esgScorer.score(
      ctx({
        provenance: sampleProvenance({
          checkpoints: [
            { location: 'X', timestamp: 1, dataHash: zeroHash },
            secondCheckpoint,
          ],
        }),
      }),
    );
    expect(s.score).toBe(10_000);
  });
  it('deducts for missing disclosure and sparse traceability', () => {
    const s = esgScorer.score(
      ctx({ provenance: sampleProvenance({ metadataURI: '' }) }),
    );
    // 10000 - 2500 (disclosure) - 1500 (single checkpoint)
    expect(s.score).toBe(6_000);
  });
  it('deducts for an ESG finding and hard-fails on critical', () => {
    const withTrail = sampleProvenance({
      checkpoints: [
        { location: 'X', timestamp: 1, dataHash: zeroHash },
        secondCheckpoint,
      ],
    });
    expect(
      esgScorer.score(ctx({ provenance: withTrail, findings: [f('COLD_CHAIN_BREACH', 'high')] }))
        .score,
    ).toBe(7_000);
    expect(
      esgScorer.score(ctx({ provenance: withTrail, findings: [f('X', 'critical')] })).score,
    ).toBe(0);
  });
});

describe('risk dimension', () => {
  it('is clean with no findings and a confident model', () => {
    expect(riskScorer.score(ctx()).score).toBe(10_000);
  });
  it('deducts aggregate risk from findings', () => {
    expect(riskScorer.score(ctx({ findings: [f('H', 'high')] })).score).toBe(7_500);
  });
  it('penalises a very weak model score', () => {
    expect(riskScorer.score(ctx({ modelScore: 2_000 })).score).toBe(8_500);
  });
  it('collapses to zero on a critical finding', () => {
    expect(riskScorer.score(ctx({ findings: [f('X', 'critical')] })).score).toBe(0);
  });
});

describe('reconciled dimension', () => {
  it('reports the stricter of model and rules', () => {
    expect(reconcilerScorer.score(ctx({ modelScore: 9_600, findings: [] })).score).toBe(
      9_600,
    );
    expect(
      reconcilerScorer.score(ctx({ modelScore: 9_800, findings: [f('H', 'high')] })).score,
    ).toBe(7_000);
  });
  it('propagates model-score validation errors', () => {
    expect(() => reconcilerScorer.score(ctx({ modelScore: 12_000 }))).toThrowError(
      AppError,
    );
  });
});

describe('reconcile over the full dimension set (strict-min)', () => {
  it('keeps a clean batch at the model score', () => {
    // A two-checkpoint, disclosed batch leaves every extended dimension clean,
    // so the model score (registered first) is the strict-min winner.
    const clean = reconcile(
      ctx({
        provenance: sampleProvenance({
          checkpoints: [
            { location: 'X', timestamp: 1, dataHash: zeroHash },
            secondCheckpoint,
          ],
        }),
      }),
      7_000,
    );
    expect(clean.finalScore).toBe(9_600);
    expect(clean.source).toBe('model');
    expect(clean.passed).toBe(true);
  });

  it('lets a context-only dimension make the verdict stricter', () => {
    // No findings (rules stays 10000) but an empty trail + no disclosure drops esg.
    const r = reconcile(
      ctx({ provenance: sampleProvenance({ checkpoints: [] }) }),
      7_000,
    );
    expect(r.source).toBe('esg');
    expect(r.finalScore).toBe(7_000);
  });

  it('any critical finding collapses the final score to zero', () => {
    const r = reconcile(ctx({ findings: [f('ORIGIN_HASH_MISMATCH', 'critical')] }), 7_000);
    expect(r.finalScore).toBe(0);
    expect(r.passed).toBe(false);
  });
});
