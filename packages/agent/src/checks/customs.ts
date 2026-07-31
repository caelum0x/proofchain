/**
 * Customs cross-check pack.
 *
 * A customs declaration is the legal statement of what is crossing a border and
 * at what value. It must reconcile with the underlying commercial documents: an
 * under-declared value or a quantity that disagrees with the invoice is a
 * classic duty-evasion / mis-declaration signal. Rules fire only when a
 * `customs_declaration` document is actually present.
 */
import { createFinding } from '../domain/findings.js';
import { registerChecks, type CrossCheck } from './registry.js';
import { moneyEqual, firstOfType, docsOfType } from './util.js';
import type { CrossCheckInput, ParsedDocument } from '../domain/types.js';
import type { Finding } from '../shared.js';

/** The declared customs value must match the commercial invoice total. */
const ruleValueMatchesInvoice = (input: CrossCheckInput): Finding[] => {
  const decl = firstOfType(input.documents, 'customs_declaration');
  const invoice = firstOfType(input.documents, 'invoice');
  const declared = decl?.fields.total;
  const invoiced = invoice?.fields.total;
  if (declared === undefined || invoiced === undefined) return [];
  if (!moneyEqual(declared, invoiced)) {
    return [
      createFinding(
        'CUSTOMS_VALUE_MISMATCH',
        'high',
        `Customs-declared value ${declared} does not match invoice total ${invoiced}.`,
        { declaredValue: declared, invoiceTotal: invoiced },
      ),
    ];
  }
  return [];
};

/** Declared quantity must match the commercial invoice quantity. */
const ruleQuantityMatchesInvoice = (input: CrossCheckInput): Finding[] => {
  const decl = firstOfType(input.documents, 'customs_declaration');
  const invoice = firstOfType(input.documents, 'invoice');
  const declared = decl?.fields.quantity;
  const invoiced = invoice?.fields.quantity;
  if (declared === undefined || invoiced === undefined) return [];
  if (declared !== invoiced) {
    return [
      createFinding(
        'CUSTOMS_QUANTITY_MISMATCH',
        'medium',
        `Customs-declared quantity ${declared} does not match invoice quantity ${invoiced}.`,
        { declaredQuantity: declared, invoiceQuantity: invoiced },
      ),
    ];
  }
  return [];
};

const namesAny = (doc: ParsedDocument): boolean =>
  (doc.fields.supplierName?.trim().length ?? 0) > 0 ||
  (doc.fields.buyerName?.trim().length ?? 0) > 0 ||
  (doc.fields.parties?.length ?? 0) > 0;

/** A customs declaration must name at least one party (consignor/consignee). */
const ruleDeclarationNamesParties = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const decl of docsOfType(input.documents, 'customs_declaration')) {
    if (!namesAny(decl)) {
      findings.push(
        createFinding(
          'CUSTOMS_MISSING_PARTIES',
          'medium',
          `Customs declaration ${decl.name} names no consignor or consignee.`,
          { document: decl.name },
        ),
      );
    }
  }
  return findings;
};

/** A customs declaration that states a value must also state its currency. */
const ruleDeclarationHasCurrency = (input: CrossCheckInput): Finding[] => {
  const findings: Finding[] = [];
  for (const decl of docsOfType(input.documents, 'customs_declaration')) {
    const hasValue = decl.fields.total !== undefined;
    const hasCurrency =
      typeof decl.fields.currency === 'string' &&
      decl.fields.currency.trim().length > 0;
    if (hasValue && !hasCurrency) {
      findings.push(
        createFinding(
          'CUSTOMS_MISSING_CURRENCY',
          'low',
          `Customs declaration ${decl.name} states a value with no currency.`,
          { document: decl.name, value: decl.fields.total },
        ),
      );
    }
  }
  return findings;
};

export const CUSTOMS_CHECKS: readonly CrossCheck[] = [
  {
    code: 'customs.value_matches_invoice',
    domain: 'customs',
    description: 'Customs-declared value must match the invoice total.',
    run: ruleValueMatchesInvoice,
  },
  {
    code: 'customs.quantity_matches_invoice',
    domain: 'customs',
    description: 'Customs-declared quantity must match the invoice quantity.',
    run: ruleQuantityMatchesInvoice,
  },
  {
    code: 'customs.declaration_names_parties',
    domain: 'customs',
    description: 'A customs declaration must name consignor/consignee.',
    run: ruleDeclarationNamesParties,
  },
  {
    code: 'customs.declaration_has_currency',
    domain: 'customs',
    description: 'A valued customs declaration must state its currency.',
    run: ruleDeclarationHasCurrency,
  },
];

registerChecks(CUSTOMS_CHECKS);
