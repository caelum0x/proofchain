/**
 * Trade-finance group handler.
 *
 * Owns the `src/tradefinance/*` contracts (Letters of Credit, factoring, PO
 * financing, dynamic discounting, securitization, guarantees, …). Every event is
 * captured to the audit table by the base handler; on top of that this projects
 * the LetterOfCredit lifecycle into the `letters_of_credit` read model the trade
 * dashboard queries. Follows the `settlement.ts` reference: `Issued` establishes
 * the row (it carries every column), later events only transition `status`.
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';
import { lower, secondsToIso, str } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'LetterOfCredit',
  'BillOfExchange',
  'FactoringAgreement',
  'PurchaseOrderFinancing',
  'DynamicDiscounting',
  'SupplyChainFinance',
  'ReceivableSecuritization',
  'TrancheToken',
  'CreditLineManager',
  'GuaranteeRegistry',
];

type LetterOfCreditRow = {
  id: string;
  applicant: string;
  beneficiary: string;
  issuing_bank: string | null;
  batch_id: string | null;
  token: string | null;
  amount: string;
  status: string;
  expiry_date: string | null;
};

/** LetterOfCredit event → target `status`. */
const LC_STATUS_BY_EVENT: Readonly<Record<string, string>> = Object.freeze({
  Issued: 'issued',
  Confirmed: 'confirmed',
  Presented: 'presented',
  Accepted: 'accepted',
  Paid: 'paid',
  Cancelled: 'cancelled',
});

const projectTradeFinance: Projector = async (
  event: DecodedEvent,
  deps: HandlerDeps,
) => {
  // `event.contract` is a `ContractName`; widen to `string` so equality against
  // this domain's contract literals is sound under the minimal test double too.
  const contract: string = event.contract;
  if (contract !== 'LetterOfCredit') return; // other TF contracts: audit-only
  if (!deps.db.isConfigured) return;

  const status = LC_STATUS_BY_EVENT[event.eventName];
  if (status === undefined) return; // non-lifecycle event — audit only

  const lcId = lower(event.args.lcId);
  if (lcId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'tradefinance: event missing lcId; skipping LC projection',
    );
    return;
  }

  if (event.eventName === 'Issued') {
    const applicant = lower(event.args.applicant);
    const beneficiary = lower(event.args.beneficiary);
    const amount = str(event.args.amount);
    if (applicant === undefined || beneficiary === undefined || amount === undefined) {
      deps.logger.warn(
        { event: event.eventName, tx: event.transactionHash },
        'tradefinance: Issued event missing required fields; skipping LC projection',
      );
      return;
    }
    await deps.db.upsert<LetterOfCreditRow>(
      'letters_of_credit',
      {
        id: lcId,
        applicant,
        beneficiary,
        issuing_bank: lower(event.args.issuingBank) ?? null,
        batch_id: lower(event.args.batchId) ?? null,
        token: lower(event.args.token) ?? null,
        amount,
        status,
        expiry_date: secondsToIso(event.args.expiry),
      },
      'id',
    );
    return;
  }

  // Transition-only events merge onto the existing row (never clobber columns).
  const existing = await deps.db.getBy<LetterOfCreditRow>('letters_of_credit', 'id', lcId);
  if (existing === null) {
    deps.logger.warn(
      { event: event.eventName, lcId },
      'tradefinance: transition for unknown LC; audit-only',
    );
    return;
  }
  await deps.db.upsert<LetterOfCreditRow>(
    'letters_of_credit',
    { ...existing, status },
    'id',
  );
};

export default makeHandler('tradefinance', projectTradeFinance, CONTRACTS);
