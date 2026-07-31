/**
 * Finding helpers: validation, construction and de-duplication. Findings can
 * come from two sources (the model via `record_finding`, and the deterministic
 * cross-check rules), so we normalize + merge them here.
 */
import { z } from 'zod';
import { SEVERITY_RANK } from '../config/constants.js';
import type { Finding, FindingSeverity } from '../shared.js';

export const severitySchema = z.enum([
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);

export const findingSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9_]+$/, 'code must be UPPER_SNAKE_CASE'),
  severity: severitySchema,
  message: z.string().min(1).max(1_000),
  evidence: z.record(z.unknown()).optional(),
});

export const createFinding = (
  code: string,
  severity: FindingSeverity,
  message: string,
  evidence?: Record<string, unknown>,
): Readonly<Finding> => ({
  code,
  severity,
  message,
  ...(evidence !== undefined ? { evidence } : {}),
});

/**
 * Merge finding lists, keeping the STRICTEST (highest severity) instance for
 * each unique code. Pure function — inputs are never mutated. Output is stable-
 * sorted by descending severity then code for deterministic verdicts.
 */
export const mergeFindings = (...lists: readonly Finding[][]): Finding[] => {
  const byCode = new Map<string, Finding>();
  for (const list of lists) {
    for (const finding of list) {
      const existing = byCode.get(finding.code);
      if (
        existing === undefined ||
        SEVERITY_RANK[finding.severity] > SEVERITY_RANK[existing.severity]
      ) {
        byCode.set(finding.code, finding);
      }
    }
  }
  return [...byCode.values()].sort((a, b) => {
    const rank = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return rank !== 0 ? rank : a.code.localeCompare(b.code);
  });
};
