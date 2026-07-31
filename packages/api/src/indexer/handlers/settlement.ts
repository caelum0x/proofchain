/**
 * Settlement group handler (M2).
 *
 * Beyond the audit-table write, this projects `SettlementEscrow` lifecycle
 * events into the `deals` read model that the web dashboard queries. It is the
 * reference implementation of a projecting handler: read the natural key from
 * the event, map it to columns, upsert idempotently. `Funded` establishes the
 * row (it carries every column); later events only transition `state`, merging
 * onto the existing row so no NOT NULL column is clobbered.
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';

type DealRow = {
  batch_id: string;
  buyer: string;
  supplier: string;
  token: string;
  amount: string;
  state: string;
  tx_hash: string | null;
};

const STATE_BY_EVENT: Readonly<Record<string, string>> = Object.freeze({
  Funded: 'funded',
  Released: 'released',
  Refunded: 'refunded',
  Disputed: 'disputed',
});

const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

const projectDeal: Projector = async (event: DecodedEvent, deps: HandlerDeps) => {
  const state = STATE_BY_EVENT[event.eventName];
  if (state === undefined) return; // e.g. PassThresholdUpdated — audit only.
  if (!deps.db.isConfigured) return;

  const batchId = str(event.args.batchId)?.toLowerCase();
  if (batchId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'settlement: event missing batchId; skipping deal projection',
    );
    return;
  }
  const txHash = event.transactionHash.toLowerCase();

  if (event.eventName === 'Funded') {
    const buyer = str(event.args.buyer)?.toLowerCase();
    const supplier = str(event.args.supplier)?.toLowerCase();
    const token = str(event.args.token)?.toLowerCase();
    const amount = str(event.args.amount);
    if (buyer === undefined || supplier === undefined || token === undefined || amount === undefined) {
      deps.logger.warn(
        { event: event.eventName, tx: txHash },
        'settlement: Funded event missing fields; skipping deal projection',
      );
      return;
    }
    await deps.db.upsert<DealRow>(
      'deals',
      { batch_id: batchId, buyer, supplier, token, amount, state, tx_hash: txHash },
      'batch_id',
    );
    return;
  }

  // Transition-only events: merge onto the existing row.
  const existing = await deps.db.getBy<DealRow>('deals', 'batch_id', batchId);
  if (existing === null) {
    deps.logger.warn(
      { event: event.eventName, batchId },
      'settlement: transition event for unknown deal; audit-only',
    );
    return;
  }
  await deps.db.upsert<DealRow>(
    'deals',
    { ...existing, state, tx_hash: txHash },
    'batch_id',
  );
};

export default makeHandler('settlement', projectDeal);
