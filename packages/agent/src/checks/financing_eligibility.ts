/**
 * Financing-eligibility cross-check pack.
 *
 * Trade finance can only advance against goods whose provenance is verifiable
 * and whose commercial terms are bankable. This pack acts as an eligibility
 * screen: it activates when a financing instrument document is presented (a
 * Letter of Credit or an insurance certificate — the signal that funding is
 * being sought) and then asserts the minimum conditions a financier requires.
 *
 * Each emitted finding is a REASON the batch is not (yet) financeable; an empty
 * result means the deterministic eligibility gate passed.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { normCurrency, isCurrencyCode, hasType, firstOfType } from './util.js';
import type { CrossCheckInput, ParsedDocument } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** Presence of any of these signals a financing request is in play. */
const FINANCING_SIGNAL_TYPES = ['letter_of_credit', 'insurance_cert'] as const;

/** Currencies a financier will fund against in this deployment. */
const FINANCEABLE_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF']);

const financingRequested = (docs: readonly ParsedDocument[]): boolean =>
  FINANCING_SIGNAL_TYPES.some((t) => hasType(docs, t));

const namesCounterparty = (doc: ParsedDocument): boolean =>
  (doc.fields.supplierName?.trim().length ?? 0) > 0 ||
  (doc.fields.buyerName?.trim().length ?? 0) > 0 ||
  (doc.fields.parties?.length ?? 0) > 0;

/** Financing requires a batch whose provenance exists on-chain. */
const ruleProvenanceVerified = (input: CrossCheckInput): Finding[] => {
  if (!financingRequested(input.documents)) return [];
  if (!input.provenance.exists) {
    return [
      createFinding(
        'FIN_UNVERIFIED_PROVENANCE',
        'high',
        'Financing requested but the batch is not registered on-chain.',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  return [];
};

/** Financing requires an underlying commercial invoice with a positive value. */
const ruleInvoiceValue = (input: CrossCheckInput): Finding[] => {
  if (!financingRequested(input.documents)) return [];
  const invoice = firstOfType(input.documents, 'invoice');
  if (invoice === undefined) {
    return [
      createFinding(
        'FIN_NO_INVOICE',
        'high',
        'Financing requested but no commercial invoice was supplied.',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  const { total } = invoice.fields;
  if (total === undefined || !(total > 0)) {
    return [
      createFinding(
        'FIN_NO_INVOICE_VALUE',
        'high',
        'Financing requested but the invoice states no positive value.',
        { document: invoice.name, total },
      ),
    ];
  }
  return [];
};

/** The invoice currency must be one the financier funds against. */
const ruleFinanceableCurrency = (input: CrossCheckInput): Finding[] => {
  if (!financingRequested(input.documents)) return [];
  const invoice = firstOfType(input.documents, 'invoice');
  const currency = invoice?.fields.currency;
  if (currency === undefined || currency.trim().length === 0) return [];
  const code = normCurrency(currency);
  if (!isCurrencyCode(currency) || !FINANCEABLE_CURRENCIES.has(code)) {
    return [
      createFinding(
        'FIN_UNSUPPORTED_CURRENCY',
        'medium',
        `Invoice currency "${currency}" is not financeable in this facility.`,
        { currency, financeable: [...FINANCEABLE_CURRENCIES] },
      ),
    ];
  }
  return [];
};

/** Financing requires an identifiable counterparty (KYC anchor). */
const ruleKnownCounterparty = (input: CrossCheckInput): Finding[] => {
  if (!financingRequested(input.documents)) return [];
  if (!input.documents.some(namesCounterparty)) {
    return [
      createFinding(
        'FIN_UNKNOWN_COUNTERPARTY',
        'medium',
        'Financing requested but no document identifies a counterparty.',
        { batchId: input.provenance.batchId },
      ),
    ];
  }
  return [];
};

export const FINANCING_ELIGIBILITY_CHECKS: readonly CrossCheck[] = [
  {
    code: 'financing_eligibility.provenance_verified',
    domain: 'financing_eligibility',
    description: 'Financing requires on-chain provenance for the batch.',
    run: ruleProvenanceVerified,
  },
  {
    code: 'financing_eligibility.invoice_value',
    domain: 'financing_eligibility',
    description: 'Financing requires an invoice with a positive value.',
    run: ruleInvoiceValue,
  },
  {
    code: 'financing_eligibility.financeable_currency',
    domain: 'financing_eligibility',
    description: 'The invoice currency must be financeable.',
    run: ruleFinanceableCurrency,
  },
  {
    code: 'financing_eligibility.known_counterparty',
    domain: 'financing_eligibility',
    description: 'Financing requires an identifiable counterparty.',
    run: ruleKnownCounterparty,
  },
];

registerChecks(FINANCING_ELIGIBILITY_CHECKS);
