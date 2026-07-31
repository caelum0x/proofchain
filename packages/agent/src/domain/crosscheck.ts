/**
 * Deterministic cross-check rules.
 *
 * Each rule is a pure function over (provenance, parsed documents) that returns
 * zero or more findings. These run INDEPENDENTLY of the model so that the
 * verdict is grounded in verifiable facts, not model opinion. Rules must be
 * total and side-effect free.
 */
import { createFinding } from './findings.js';
import type { CrossCheckInput, ParsedDocument } from './types.js';
import type { Finding } from '../shared.js';
import type { CrossCheck } from '../checks/registry.js';

/** Two monetary values are "equal" within 0.5% relative or 1 cent absolute. */
const moneyEqual = (a: number, b: number): boolean => {
  const diff = Math.abs(a - b);
  if (diff <= 0.01) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return diff / scale <= 0.005;
};

const normalizeHash = (h: string): string => h.trim().toLowerCase();

const isInvoice = (d: ParsedDocument): boolean => d.docType === 'invoice';

/** No documents were supplied/parsed — nothing to verify against. */
const ruleNoDocuments = (input: CrossCheckInput): Finding[] =>
  input.documents.length === 0
    ? [
        createFinding(
          'NO_DOCUMENTS',
          'high',
          'No documents were supplied for verification.',
        ),
      ]
    : [];

/** Batch must exist on-chain; missing checkpoints weakens provenance. */
const ruleProvenancePresence = (input: CrossCheckInput): Finding[] => {
  const { provenance } = input;
  if (!provenance.exists) {
    return [
      createFinding(
        'UNKNOWN_BATCH',
        'critical',
        'Batch is not registered in the on-chain ProvenanceRegistry.',
        { batchId: provenance.batchId },
      ),
    ];
  }
  if (provenance.checkpoints.length === 0) {
    return [
      createFinding(
        'NO_CHECKPOINTS',
        'medium',
        'Batch has no on-chain checkpoints; provenance trail is empty.',
        { batchId: provenance.batchId },
      ),
    ];
  }
  return [];
};

/** Invoice line items must sum to the stated invoice total. */
const ruleInvoiceTotals = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    if (!isInvoice(doc)) continue;
    const { total, lineItems } = doc.fields;
    if (total === undefined || lineItems === undefined || lineItems.length === 0) {
      continue;
    }
    const sum = lineItems.reduce((acc, li) => acc + li.amount, 0);
    if (!moneyEqual(sum, total)) {
      findings.push(
        createFinding(
          'INVOICE_TOTAL_MISMATCH',
          'high',
          `Invoice line items sum to ${sum} but stated total is ${total}.`,
          { document: doc.name, lineItemSum: sum, statedTotal: total },
        ),
      );
    }
  }
  return findings;
};

/** Each line item's amount must equal quantity * unitPrice. */
const ruleLineItemMath = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const items = doc.fields.lineItems;
    if (items === undefined) continue;
    for (const [i, li] of items.entries()) {
      const expected = li.quantity * li.unitPrice;
      if (!moneyEqual(expected, li.amount)) {
        findings.push(
          createFinding(
            'LINE_ITEM_AMOUNT_MISMATCH',
            'medium',
            `Line item ${i} amount ${li.amount} != quantity*unitPrice ${expected}.`,
            { document: doc.name, index: i, expected, actual: li.amount },
          ),
        );
      }
    }
  }
  return findings;
};

/** A document-declared origin hash must match the on-chain origin hash. */
const ruleOriginHash = (input: CrossCheckInput): Finding[] => {
  const onchain = normalizeHash(input.provenance.originHash);
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const declared = doc.fields.originHash;
    if (declared === undefined) continue;
    if (normalizeHash(declared) !== onchain) {
      findings.push(
        createFinding(
          'ORIGIN_HASH_MISMATCH',
          'critical',
          'Document origin hash does not match the on-chain origin hash.',
          { document: doc.name, declared, onchain: input.provenance.originHash },
        ),
      );
    }
  }
  return findings;
};

/** Declared quantities across documents must agree. */
const ruleQuantityConsistency = (input: CrossCheckInput): Finding[] => {
  const withQty = input.documents.filter((d) => d.fields.quantity !== undefined);
  if (withQty.length < 2) return [];
  const quantities = withQty.map((d) => d.fields.quantity as number);
  const min = Math.min(...quantities);
  const max = Math.max(...quantities);
  if (min !== max) {
    return [
      createFinding(
        'QUANTITY_MISMATCH',
        'high',
        `Documents disagree on quantity (min ${min}, max ${max}).`,
        {
          quantities: withQty.map((d) => ({
            document: d.name,
            quantity: d.fields.quantity,
          })),
        },
      ),
    ];
  }
  return [];
};

/** Supplier name (where present) must be consistent across documents. */
const ruleSupplierConsistency = (input: CrossCheckInput): Finding[] => {
  const names = new Set(
    input.documents
      .map((d) => d.fields.supplierName?.trim().toLowerCase())
      .filter((n): n is string => n !== undefined && n.length > 0),
  );
  if (names.size > 1) {
    return [
      createFinding(
        'SUPPLIER_MISMATCH',
        'high',
        'Documents disagree on the supplier/party name.',
        { suppliers: [...names] },
      ),
    ];
  }
  return [];
};

/** Invoice dated before the batch was created is temporally inconsistent. */
const ruleDateConsistency = (input: CrossCheckInput): Finding[] => {
  const { createdAt } = input.provenance;
  if (createdAt <= 0) return [];
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const iso = doc.fields.date;
    if (iso === undefined) continue;
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) continue;
    if (Math.floor(ts / 1000) < createdAt) {
      findings.push(
        createFinding(
          'DATE_INCONSISTENCY',
          'low',
          'Document is dated before the batch was registered on-chain.',
          { document: doc.name, documentDate: iso, batchCreatedAt: createdAt },
        ),
      );
    }
  }
  return findings;
};

/** Checkpoint timestamps must be non-decreasing. */
const ruleCheckpointOrder = (input: CrossCheckInput): Finding[] => {
  const cps = input.provenance.checkpoints;
  for (let i = 1; i < cps.length; i += 1) {
    const prev = cps[i - 1];
    const cur = cps[i];
    if (prev !== undefined && cur !== undefined && cur.timestamp < prev.timestamp) {
      return [
        createFinding(
          'CHECKPOINT_ORDER',
          'low',
          'On-chain checkpoints are not in chronological order.',
          { atIndex: i },
        ),
      ];
    }
  }
  return [];
};

/**
 * The builtin cross-checks as `CrossCheck` objects. These are registered into
 * the check registry (see src/checks/core.ts) so the verification pipeline and
 * any Fill domain rule packs share one execution path. Order matches the
 * original RULES array so findings remain order-stable.
 */
export const CORE_CHECKS: readonly CrossCheck[] = [
  {
    code: 'core.no_documents',
    domain: 'structural',
    description: 'At least one document must be supplied for verification.',
    run: ruleNoDocuments,
  },
  {
    code: 'core.provenance_presence',
    domain: 'provenance',
    description: 'Batch must exist on-chain and carry a checkpoint trail.',
    run: ruleProvenancePresence,
  },
  {
    code: 'core.invoice_totals',
    domain: 'trade',
    description: 'Invoice line items must sum to the stated total.',
    run: ruleInvoiceTotals,
  },
  {
    code: 'core.line_item_math',
    domain: 'trade',
    description: 'Each line item amount must equal quantity × unit price.',
    run: ruleLineItemMath,
  },
  {
    code: 'core.origin_hash',
    domain: 'provenance',
    description: 'Document origin hash must match the on-chain origin hash.',
    run: ruleOriginHash,
  },
  {
    code: 'core.quantity_consistency',
    domain: 'quantity',
    description: 'Declared quantities must agree across documents.',
    run: ruleQuantityConsistency,
  },
  {
    code: 'core.supplier_consistency',
    domain: 'trade',
    description: 'Supplier/party names must be consistent across documents.',
    run: ruleSupplierConsistency,
  },
  {
    code: 'core.date_consistency',
    domain: 'temporal',
    description: 'Documents must not predate on-chain batch registration.',
    run: ruleDateConsistency,
  },
  {
    code: 'core.checkpoint_order',
    domain: 'provenance',
    description: 'On-chain checkpoint timestamps must be non-decreasing.',
    run: ruleCheckpointOrder,
  },
];

/** Run every builtin cross-check and collect all findings (order-stable). */
export const runCrossChecks = (input: CrossCheckInput): Finding[] =>
  CORE_CHECKS.flatMap((check) => check.run(input));
