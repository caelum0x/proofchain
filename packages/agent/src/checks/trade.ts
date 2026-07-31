/**
 * Trade cross-check pack.
 *
 * Commercial-document integrity that spans MULTIPLE papers in a shipment: the
 * currency the deal is denominated in must be a real code and agree everywhere,
 * invoice values must be positive, and where a Letter of Credit accompanies the
 * commercial invoice the two headline amounts must reconcile. These complement
 * (never duplicate) the builtin single-invoice total/line-item rules.
 *
 * Every rule is presence-gated: it emits nothing unless the fields it validates
 * are actually present, so a minimal document set produces no noise.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import {
  isCurrencyCode,
  moneyEqual,
  normCurrency,
  firstOfType,
} from './util.js';
import type { CrossCheckInput } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** Every distinct currency declared across the document set must agree. */
const ruleCurrencyConsistency = (input: CrossCheckInput): Finding[] => {
  const codes = new Set(
    input.documents
      .map((d) => d.fields.currency)
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map(normCurrency),
  );
  if (codes.size > 1) {
    return [
      createFinding(
        'TRADE_CURRENCY_MISMATCH',
        'high',
        `Documents are denominated in conflicting currencies: ${[...codes].join(', ')}.`,
        { currencies: [...codes] },
      ),
    ];
  }
  return [];
};

/** A declared currency must look like an ISO-4217 code (three letters). */
const ruleCurrencyCodeValid = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    const code = doc.fields.currency;
    if (code === undefined || code.trim().length === 0) continue;
    if (!isCurrencyCode(code)) {
      findings.push(
        createFinding(
          'TRADE_CURRENCY_INVALID',
          'low',
          `Currency code "${code}" on ${doc.name} is not a valid ISO-4217 code.`,
          { document: doc.name, currency: code },
        ),
      );
    }
  }
  return findings;
};

/** An invoice total, when stated, must be strictly positive. */
const ruleInvoiceTotalPositive = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const doc of input.documents) {
    if (doc.docType !== 'invoice') continue;
    const { total } = doc.fields;
    if (total === undefined) continue;
    if (!(total > 0)) {
      findings.push(
        createFinding(
          'TRADE_NONPOSITIVE_TOTAL',
          'high',
          `Invoice ${doc.name} declares a non-positive total (${total}).`,
          { document: doc.name, total },
        ),
      );
    }
  }
  return findings;
};

/** A commercial invoice and its Letter of Credit must state the same amount. */
const ruleInvoiceLcReconcile = (input: CrossCheckInput): Finding[] => {
  const invoice = firstOfType(input.documents, 'invoice');
  const lc = firstOfType(input.documents, 'letter_of_credit');
  const invTotal = invoice?.fields.total;
  const lcTotal = lc?.fields.total;
  if (invTotal === undefined || lcTotal === undefined) return [];
  if (!moneyEqual(invTotal, lcTotal)) {
    return [
      createFinding(
        'TRADE_INVOICE_LC_MISMATCH',
        'high',
        `Invoice total ${invTotal} does not match the Letter of Credit amount ${lcTotal}.`,
        { invoiceTotal: invTotal, lcAmount: lcTotal },
      ),
    ];
  }
  return [];
};

export const TRADE_CHECKS: readonly CrossCheck[] = [
  {
    code: 'trade.currency_consistency',
    domain: 'trade',
    description: 'All documents must be denominated in a single currency.',
    run: ruleCurrencyConsistency,
  },
  {
    code: 'trade.currency_code_valid',
    domain: 'trade',
    description: 'Declared currency codes must be valid ISO-4217 codes.',
    run: ruleCurrencyCodeValid,
  },
  {
    code: 'trade.invoice_total_positive',
    domain: 'trade',
    description: 'A stated invoice total must be strictly positive.',
    run: ruleInvoiceTotalPositive,
  },
  {
    code: 'trade.invoice_lc_reconcile',
    domain: 'trade',
    description: 'Invoice total must match the accompanying Letter of Credit.',
    run: ruleInvoiceLcReconcile,
  },
];

registerChecks(TRADE_CHECKS);
