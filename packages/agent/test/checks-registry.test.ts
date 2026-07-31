import { describe, expect, it } from 'vitest';
import {
  checkRegistry,
  registerCheck,
  runChecksForDomain,
  runRegisteredChecks,
} from '../src/checks/index.js';
import { runCrossChecks } from '../src/domain/crosscheck.js';
import { createFinding } from '../src/domain/findings.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import type { CrossCheckInput } from '../src/domain/types.js';

const cleanInput = (): CrossCheckInput => ({
  provenance: sampleProvenance(),
  documents: [invoiceDoc()],
});

const fraudInput = (): CrossCheckInput => ({
  provenance: sampleProvenance({ exists: false }),
  documents: [invoiceDoc({ fields: { originHash: '0xdeadbeef' } })],
});

describe('checks registry (builtins)', () => {
  it('registers all nine core checks', () => {
    const keys = checkRegistry.keys();
    expect(keys).toContain('core.invoice_totals');
    expect(keys).toContain('core.origin_hash');
    expect(keys.length).toBeGreaterThanOrEqual(9);
  });

  it('runRegisteredChecks matches legacy runCrossChecks (behaviour identity)', () => {
    expect(runRegisteredChecks(cleanInput())).toEqual(
      runCrossChecks(cleanInput()),
    );
    expect(runRegisteredChecks(fraudInput())).toEqual(
      runCrossChecks(fraudInput()),
    );
  });

  it('runChecksForDomain filters to a single domain', () => {
    const provenanceFindings = runChecksForDomain(fraudInput(), 'provenance');
    const codes = provenanceFindings.map((f) => f.code);
    // UNKNOWN_BATCH and ORIGIN_HASH_MISMATCH are both "provenance" domain rules.
    expect(codes).toContain('UNKNOWN_BATCH');
    expect(codes).toContain('ORIGIN_HASH_MISMATCH');
    // A trade-only code must NOT appear in the provenance slice.
    expect(codes).not.toContain('INVOICE_TOTAL_MISMATCH');
  });

  it('supports Fill-agent registration of a new domain check', () => {
    const before = runRegisteredChecks(cleanInput()).length;
    registerCheck({
      code: 'test.always_flags',
      domain: 'test',
      description: 'A synthetic check for the registry test.',
      run: () => [createFinding('TEST_FLAG', 'info', 'synthetic')],
    });
    const after = runRegisteredChecks(cleanInput());
    expect(after.length).toBe(before + 1);
    expect(after.map((f) => f.code)).toContain('TEST_FLAG');
  });
});
