/**
 * Origin cross-check pack.
 *
 * A certificate of origin must agree with the rest of the shipment about WHO
 * produced the goods and WHEN. The builtin `core.origin_hash` rule already binds
 * the document origin hash to the chain; this pack adds the human-readable
 * consistency checks a certificate of origin uniquely enables. Rules fire only
 * when a `certificate_of_origin` is present.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { normName, docsOfType, toUnixSeconds, firstOfType } from './util.js';
import type { CrossCheckInput, ParsedDocument } from '../domain/types.js';
import type { Finding } from '../shared.js';

const originCerts = (input: CrossCheckInput): ParsedDocument[] =>
  docsOfType(input.documents, 'certificate_of_origin');

/** The certificate's supplier must match the commercial invoice supplier. */
const ruleSupplierMatchesInvoice = (input: CrossCheckInput): Finding[] => {
  const invoice = firstOfType(input.documents, 'invoice');
  const invoiceSupplier = invoice?.fields.supplierName;
  if (invoiceSupplier === undefined || invoiceSupplier.trim().length === 0) {
    return [];
  }
  const findings: Finding[] = [];
  for (const cert of originCerts(input)) {
    const supplier = cert.fields.supplierName;
    if (supplier === undefined || supplier.trim().length === 0) continue;
    if (normName(supplier) !== normName(invoiceSupplier)) {
      findings.push(
        createFinding(
          'ORIGIN_SUPPLIER_MISMATCH',
          'high',
          `Certificate of origin ${cert.name} names supplier "${supplier}" but the invoice names "${invoiceSupplier}".`,
          { document: cert.name, certSupplier: supplier, invoiceSupplier },
        ),
      );
    }
  }
  return findings;
};

/** A certificate of origin must actually identify the producer/exporter. */
const ruleCertNotEmpty = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const cert of originCerts(input)) {
    const identifies =
      (cert.fields.supplierName?.trim().length ?? 0) > 0 ||
      (cert.fields.parties?.length ?? 0) > 0;
    if (!identifies) {
      findings.push(
        createFinding(
          'ORIGIN_CERT_INCOMPLETE',
          'medium',
          `Certificate of origin ${cert.name} identifies no producer or exporter.`,
          { document: cert.name },
        ),
      );
    }
  }
  return findings;
};

/** A certificate of origin must not predate the batch it certifies. */
const ruleCertNotPredatingBatch = (input: CrossCheckInput): Finding[] => {
  const { createdAt } = input.provenance;
  if (createdAt <= 0) return [];
  const findings: Finding[] = [];
  for (const cert of originCerts(input)) {
    const ts = toUnixSeconds(cert.fields.date);
    if (ts === undefined) continue;
    if (ts < createdAt) {
      findings.push(
        createFinding(
          'ORIGIN_CERT_PREDATES_BATCH',
          'low',
          `Certificate of origin ${cert.name} is dated before the batch was registered.`,
          { document: cert.name, certDate: cert.fields.date, batchCreatedAt: createdAt },
        ),
      );
    }
  }
  return findings;
};

export const ORIGIN_CHECKS: readonly CrossCheck[] = [
  {
    code: 'origin.supplier_matches_invoice',
    domain: 'origin',
    description: 'Certificate-of-origin supplier must match the invoice.',
    run: ruleSupplierMatchesInvoice,
  },
  {
    code: 'origin.cert_not_empty',
    domain: 'origin',
    description: 'A certificate of origin must identify the producer/exporter.',
    run: ruleCertNotEmpty,
  },
  {
    code: 'origin.cert_not_predating_batch',
    domain: 'origin',
    description: 'A certificate of origin must not predate the batch.',
    run: ruleCertNotPredatingBatch,
  },
];

registerChecks(ORIGIN_CHECKS);
