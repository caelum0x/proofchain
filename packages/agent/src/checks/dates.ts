/**
 * Dates cross-check pack.
 *
 * Temporal integrity beyond the builtin "document predates batch" rule: a date
 * that is present must actually parse, the spread of dates across a single
 * shipment's papers must be physically plausible (papers years apart signal a
 * recycled/forged document), and no on-chain checkpoint may be stamped before
 * the batch itself was created. All rules are pure (no wall-clock reads).
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { toUnixSeconds } from './util.js';
import type { CrossCheckInput } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** Largest plausible spread between documents of one shipment: ~3 years. */
const MAX_DATE_SPREAD_SECONDS = 3 * 365 * 24 * 60 * 60;

/** A present date field must be a parseable ISO-8601 date. */
const ruleValidFormat = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const raw = doc.fields.date;
    if (raw === undefined || raw.trim().length === 0) continue;
    if (toUnixSeconds(raw) === undefined) {
      findings.push(
        createFinding(
          'DATES_INVALID_FORMAT',
          'low',
          `Document ${doc.name} has an unparseable date ("${raw}").`,
          { document: doc.name, date: raw },
        ),
      );
    }
  }
  return findings;
};

/** Dates across the document set must not span an implausible range. */
const ruleSpreadPlausible = (input: CrossCheckInput): Finding[] => {
  const stamps = input.documents
    .map((d) => toUnixSeconds(d.fields.date))
    .filter((t): t is number => t !== undefined);
  if (stamps.length < 2) return [];
  const min = Math.min(...stamps);
  const max = Math.max(...stamps);
  const spread = max - min;
  if (spread > MAX_DATE_SPREAD_SECONDS) {
    return [
      createFinding(
        'DATES_IMPLAUSIBLE_SPREAD',
        'low',
        `Document dates span ${spread}s, exceeding the ${MAX_DATE_SPREAD_SECONDS}s plausibility window.`,
        { spreadSeconds: spread, limitSeconds: MAX_DATE_SPREAD_SECONDS },
      ),
    ];
  }
  return [];
};

/** No checkpoint may be timestamped before the batch was created on-chain. */
const ruleCheckpointNotBeforeOrigin = (input: CrossCheckInput): Finding[] => {
  const { createdAt, checkpoints } = input.provenance;
  if (createdAt <= 0) return [];
  const findings: Finding[] = [];
  for (const [i, cp] of checkpoints.entries()) {
    if (cp.timestamp < createdAt) {
      findings.push(
        createFinding(
          'DATES_CHECKPOINT_BEFORE_ORIGIN',
          'medium',
          `Checkpoint ${i} is timestamped before the batch origin.`,
          { atIndex: i, checkpointAt: cp.timestamp, batchCreatedAt: createdAt },
        ),
      );
    }
  }
  return findings;
};

export const DATES_CHECKS: readonly CrossCheck[] = [
  {
    code: 'dates.valid_format',
    domain: 'dates',
    description: 'A present document date must be a parseable ISO-8601 date.',
    run: ruleValidFormat,
  },
  {
    code: 'dates.spread_plausible',
    domain: 'dates',
    description: 'Document dates must span a physically plausible range.',
    run: ruleSpreadPlausible,
  },
  {
    code: 'dates.checkpoint_not_before_origin',
    domain: 'dates',
    description: 'No checkpoint may predate the batch origin timestamp.',
    run: ruleCheckpointNotBeforeOrigin,
  },
];

registerChecks(DATES_CHECKS);
