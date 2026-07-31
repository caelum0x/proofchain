/**
 * Quality cross-check pack.
 *
 * Inspection and laboratory reports are the evidence that goods meet the agreed
 * specification. They must describe the SAME shipment as the commercial papers
 * (same supplier, same quantity) and must not predate the batch they claim to
 * certify. Rules fire only when an `inspection_report` or `lab_report` is
 * present.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { normName, docsOfType, toUnixSeconds, firstOfType } from './util.js';
import type { CrossCheckInput, ParsedDocument } from '../domain/types.js';
import type { Finding } from '../shared.js';

const QUALITY_TYPES = ['inspection_report', 'lab_report'] as const;

const qualityDocs = (input: CrossCheckInput): ParsedDocument[] =>
  QUALITY_TYPES.flatMap((t) => docsOfType(input.documents, t));

/** A quality report's supplier must match the commercial invoice supplier. */
const ruleSupplierConsistency = (input: CrossCheckInput): Finding[] => {
  const invoice = firstOfType(input.documents, 'invoice');
  const invoiceSupplier = invoice?.fields.supplierName;
  if (invoiceSupplier === undefined || invoiceSupplier.trim().length === 0) {
    return [];
  }
  const findings: Finding[] = [];
  for (const doc of qualityDocs(input)) {
    const supplier = doc.fields.supplierName;
    if (supplier === undefined || supplier.trim().length === 0) continue;
    if (normName(supplier) !== normName(invoiceSupplier)) {
      findings.push(
        createFinding(
          'QUALITY_SUPPLIER_MISMATCH',
          'medium',
          `Quality report ${doc.name} names supplier "${supplier}" but the invoice names "${invoiceSupplier}".`,
          { document: doc.name, reportSupplier: supplier, invoiceSupplier },
        ),
      );
    }
  }
  return findings;
};

/** A quality report's quantity must match the invoiced quantity. */
const ruleQuantityConsistency = (input: CrossCheckInput): Finding[] => {
  const invoice = firstOfType(input.documents, 'invoice');
  const invoiceQty = invoice?.fields.quantity;
  if (invoiceQty === undefined) return [];
  const findings: Finding[] = [];
  for (const doc of qualityDocs(input)) {
    const qty = doc.fields.quantity;
    if (qty === undefined) continue;
    if (qty !== invoiceQty) {
      findings.push(
        createFinding(
          'QUALITY_QUANTITY_MISMATCH',
          'medium',
          `Quality report ${doc.name} covers quantity ${qty} but the invoice states ${invoiceQty}.`,
          { document: doc.name, reportQuantity: qty, invoiceQuantity: invoiceQty },
        ),
      );
    }
  }
  return findings;
};

/** A quality report must not be dated before the batch was registered. */
const ruleNotStale = (input: CrossCheckInput): Finding[] => {
  const { createdAt } = input.provenance;
  if (createdAt <= 0) return [];
  const findings: Finding[] = [];
  for (const doc of qualityDocs(input)) {
    const ts = toUnixSeconds(doc.fields.date);
    if (ts === undefined) continue;
    if (ts < createdAt) {
      findings.push(
        createFinding(
          'QUALITY_STALE_INSPECTION',
          'medium',
          `Quality report ${doc.name} is dated before the batch was registered on-chain.`,
          { document: doc.name, reportDate: doc.fields.date, batchCreatedAt: createdAt },
        ),
      );
    }
  }
  return findings;
};

/** A quality report carrying no supplier, quantity or date is uninformative. */
const ruleReportNotEmpty = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of qualityDocs(input)) {
    const empty =
      (doc.fields.supplierName?.trim().length ?? 0) === 0 &&
      doc.fields.quantity === undefined &&
      doc.fields.date === undefined &&
      (doc.fields.parties?.length ?? 0) === 0;
    if (empty) {
      findings.push(
        createFinding(
          'QUALITY_EMPTY_REPORT',
          'low',
          `Quality report ${doc.name} contains no verifiable fields.`,
          { document: doc.name },
        ),
      );
    }
  }
  return findings;
};

export const QUALITY_CHECKS: readonly CrossCheck[] = [
  {
    code: 'quality.supplier_consistency',
    domain: 'quality',
    description: 'Quality report supplier must match the invoice supplier.',
    run: ruleSupplierConsistency,
  },
  {
    code: 'quality.quantity_consistency',
    domain: 'quality',
    description: 'Quality report quantity must match the invoiced quantity.',
    run: ruleQuantityConsistency,
  },
  {
    code: 'quality.not_stale',
    domain: 'quality',
    description: 'A quality report must not predate batch registration.',
    run: ruleNotStale,
  },
  {
    code: 'quality.report_not_empty',
    domain: 'quality',
    description: 'A quality report must carry at least one verifiable field.',
    run: ruleReportNotEmpty,
  },
];

registerChecks(QUALITY_CHECKS);
