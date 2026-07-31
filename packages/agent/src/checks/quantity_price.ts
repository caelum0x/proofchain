/**
 * Quantity & price cross-check pack.
 *
 * Sanity of the numeric core of a trade: quantities and unit prices must be
 * positive and plausible, and value-bearing documents that are NOT invoices
 * (the invoice total rule already covers invoices) must still have their line
 * items reconcile to the stated total. Catches negative/zero smuggling tricks
 * and absurd unit prices used to inflate or deflate value.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { moneyEqual, lineItemTotal, isFiniteNumber } from './util.js';
import type { CrossCheckInput } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** Upper bound for a plausible per-unit price (guards against fat-finger/inflation). */
const MAX_PLAUSIBLE_UNIT_PRICE = 1_000_000_000;

/** Declared quantities (line-item and document-level) must be positive. */
const ruleNonPositiveQuantity = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    if (doc.fields.quantity !== undefined && !(doc.fields.quantity > 0)) {
      findings.push(
        createFinding(
          'QP_NONPOSITIVE_QUANTITY',
          'high',
          `Document ${doc.name} declares a non-positive quantity (${doc.fields.quantity}).`,
          { document: doc.name, quantity: doc.fields.quantity },
        ),
      );
    }
    for (const [i, li] of (doc.fields.lineItems ?? []).entries()) {
      if (!(li.quantity > 0)) {
        findings.push(
          createFinding(
            'QP_NONPOSITIVE_QUANTITY',
            'high',
            `Line item ${i} on ${doc.name} has a non-positive quantity (${li.quantity}).`,
            { document: doc.name, index: i, quantity: li.quantity },
          ),
        );
      }
    }
  }
  return findings;
};

/** Line-item unit prices must be positive. */
const ruleNonPositivePrice = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    for (const [i, li] of (doc.fields.lineItems ?? []).entries()) {
      if (!(li.unitPrice > 0)) {
        findings.push(
          createFinding(
            'QP_NONPOSITIVE_PRICE',
            'high',
            `Line item ${i} on ${doc.name} has a non-positive unit price (${li.unitPrice}).`,
            { document: doc.name, index: i, unitPrice: li.unitPrice },
          ),
        );
      }
    }
  }
  return findings;
};

/** Unit prices beyond a sane ceiling are implausible and worth flagging. */
const ruleImplausibleUnitPrice = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    for (const [i, li] of (doc.fields.lineItems ?? []).entries()) {
      if (!isFiniteNumber(li.unitPrice)) continue;
      if (li.unitPrice > MAX_PLAUSIBLE_UNIT_PRICE) {
        findings.push(
          createFinding(
            'QP_IMPLAUSIBLE_UNIT_PRICE',
            'medium',
            `Line item ${i} on ${doc.name} has an implausible unit price (${li.unitPrice}).`,
            { document: doc.name, index: i, unitPrice: li.unitPrice, ceiling: MAX_PLAUSIBLE_UNIT_PRICE },
          ),
        );
      }
    }
  }
  return findings;
};

/**
 * A non-invoice value document (packing list, proforma, …) whose line items
 * carry amounts must still reconcile to any stated total. Invoices are covered
 * by the builtin `core.invoice_totals` rule, so they are skipped here to avoid a
 * duplicate finding.
 */
const ruleNonInvoiceTotalReconcile = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    if (doc.docType === 'invoice') continue;
    const { total } = doc.fields;
    const sum = lineItemTotal(doc);
    if (total === undefined || sum === undefined) continue;
    if (!moneyEqual(sum, total)) {
      findings.push(
        createFinding(
          'QP_TOTAL_RECONCILE_MISMATCH',
          'medium',
          `Line items on ${doc.name} sum to ${sum} but the stated total is ${total}.`,
          { document: doc.name, lineItemSum: sum, statedTotal: total },
        ),
      );
    }
  }
  return findings;
};

export const QUANTITY_PRICE_CHECKS: readonly CrossCheck[] = [
  {
    code: 'quantity_price.nonpositive_quantity',
    domain: 'quantity_price',
    description: 'Declared quantities must be strictly positive.',
    run: ruleNonPositiveQuantity,
  },
  {
    code: 'quantity_price.nonpositive_price',
    domain: 'quantity_price',
    description: 'Line-item unit prices must be strictly positive.',
    run: ruleNonPositivePrice,
  },
  {
    code: 'quantity_price.implausible_unit_price',
    domain: 'quantity_price',
    description: 'Unit prices must stay below a plausible ceiling.',
    run: ruleImplausibleUnitPrice,
  },
  {
    code: 'quantity_price.noninvoice_total_reconcile',
    domain: 'quantity_price',
    description: 'Non-invoice value documents must reconcile line items to total.',
    run: ruleNonInvoiceTotalReconcile,
  },
];

registerChecks(QUANTITY_PRICE_CHECKS);
