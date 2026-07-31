/**
 * Cold-chain cross-check pack.
 *
 * Perishable / reefer shipments carry a temperature data-logger record
 * (`cold_chain_log`). Even before temperature values are available, the log's
 * INTEGRITY as evidence can be verified against the on-chain provenance trail:
 * a log must be backed by checkpoints, must sit within the shipment's timeline,
 * and the checkpoint trail must be continuous (no monitoring gap large enough to
 * hide an excursion). Rules fire only when a `cold_chain_log` is present.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { normName, docsOfType, toUnixSeconds, hasType, firstOfType } from './util.js';
import type { CrossCheckInput, ParsedDocument } from '../domain/types.js';
import type { Finding } from '../shared.js';

/**
 * Maximum tolerated gap between two consecutive on-chain checkpoints while a
 * shipment is under cold-chain monitoring. Six hours: long enough for routine
 * transit legs, short enough that a silent reefer failure cannot hide.
 */
const COLD_CHAIN_MAX_GAP_SECONDS = 6 * 60 * 60;

const coldChainLogs = (input: CrossCheckInput): ParsedDocument[] =>
  docsOfType(input.documents, 'cold_chain_log');

/** A cold-chain log must be backed by an on-chain checkpoint trail. */
const ruleLogHasCheckpoints = (input: CrossCheckInput): Finding[] => {
  if (!hasType(input.documents, 'cold_chain_log')) return [];
  if (input.provenance.checkpoints.length === 0) {
    return [
      createFinding(
        'COLD_CHAIN_NO_CHECKPOINTS',
        'medium',
        'A cold-chain log was supplied but the batch has no on-chain checkpoints to corroborate it.',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  return [];
};

/** A cold-chain log must not be dated before the batch was registered. */
const ruleLogWithinWindow = (input: CrossCheckInput): Finding[] => {
  const { createdAt } = input.provenance;
  if (createdAt <= 0) return [];
  const findings: Finding[] = [];
  for (const log of coldChainLogs(input)) {
    const ts = toUnixSeconds(log.fields.date);
    if (ts === undefined) continue;
    if (ts < createdAt) {
      findings.push(
        createFinding(
          'COLD_CHAIN_LOG_BEFORE_ORIGIN',
          'medium',
          `Cold-chain log ${log.name} is dated before the batch origin timestamp.`,
          { document: log.name, logDate: log.fields.date, batchCreatedAt: createdAt },
        ),
      );
    }
  }
  return findings;
};

/** With a cold-chain log present, the checkpoint trail must be continuous. */
const ruleCheckpointContinuity = (input: CrossCheckInput): Finding[] => {
  if (!hasType(input.documents, 'cold_chain_log')) return [];
  const cps = input.provenance.checkpoints;
  for (let i = 1; i < cps.length; i += 1) {
    const prev = cps[i - 1];
    const cur = cps[i];
    if (prev === undefined || cur === undefined) continue;
    const gap = cur.timestamp - prev.timestamp;
    if (gap > COLD_CHAIN_MAX_GAP_SECONDS) {
      return [
        createFinding(
          'COLD_CHAIN_MONITORING_GAP',
          'high',
          `Cold-chain monitoring gap of ${gap}s between checkpoints exceeds the ${COLD_CHAIN_MAX_GAP_SECONDS}s limit.`,
          { atIndex: i, gapSeconds: gap, limitSeconds: COLD_CHAIN_MAX_GAP_SECONDS },
        ),
      ];
    }
  }
  return [];
};

/** A cold-chain log should describe the same supplier as the shipment. */
const ruleLogSupplierConsistency = (input: CrossCheckInput): Finding[] => {
  const invoice = firstOfType(input.documents, 'invoice');
  const invoiceSupplier = invoice?.fields.supplierName;
  if (invoiceSupplier === undefined || invoiceSupplier.trim().length === 0) {
    return [];
  }
  const findings: Finding[] = [];
  for (const log of coldChainLogs(input)) {
    const supplier = log.fields.supplierName;
    if (supplier === undefined || supplier.trim().length === 0) continue;
    if (normName(supplier) !== normName(invoiceSupplier)) {
      findings.push(
        createFinding(
          'COLD_CHAIN_SUPPLIER_MISMATCH',
          'low',
          `Cold-chain log ${log.name} names a different supplier than the invoice.`,
          { document: log.name, logSupplier: supplier, invoiceSupplier },
        ),
      );
    }
  }
  return findings;
};

export const COLD_CHAIN_CHECKS: readonly CrossCheck[] = [
  {
    code: 'cold_chain.log_has_checkpoints',
    domain: 'cold_chain',
    description: 'A cold-chain log must be backed by on-chain checkpoints.',
    run: ruleLogHasCheckpoints,
  },
  {
    code: 'cold_chain.log_within_window',
    domain: 'cold_chain',
    description: 'A cold-chain log must not predate batch registration.',
    run: ruleLogWithinWindow,
  },
  {
    code: 'cold_chain.checkpoint_continuity',
    domain: 'cold_chain',
    description: 'Checkpoint trail must be continuous under cold-chain monitoring.',
    run: ruleCheckpointContinuity,
  },
  {
    code: 'cold_chain.log_supplier_consistency',
    domain: 'cold_chain',
    description: 'A cold-chain log must reference the shipment supplier.',
    run: ruleLogSupplierConsistency,
  },
];

registerChecks(COLD_CHAIN_CHECKS);
