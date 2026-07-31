/**
 * Logistics group handler.
 *
 * Owns `src/logistics/*` (freight booking, cold-chain, bonded/last-mile,
 * fleet, route, container). Beyond the audit table it projects the FreightBooking
 * lifecycle into the `freight` read model: `Requested` establishes the booking,
 * `Confirmed` attaches the ETA (leaving status at `booked` until a downstream
 * delivery/cancel event moves it). Other logistics contracts are audit-only.
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';
import { lower, secondsToIso } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'FreightBooking',
  'ColdChainMonitor',
  'BondedWarehouse',
  'FleetRegistry',
  'RouteAttestation',
  'CustomsBonded',
  'ContainerRegistry',
  'LastMileProofOfDelivery',
];

type FreightRow = {
  id: string;
  batch_id: string | null;
  shipper: string | null;
  carrier: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  eta: string | null;
  metadata: Record<string, unknown>;
};

const projectLogistics: Projector = async (
  event: DecodedEvent,
  deps: HandlerDeps,
) => {
  const contract: string = event.contract; // widen for sound literal comparison
  if (contract !== 'FreightBooking') return; // audit-only otherwise
  if (!deps.db.isConfigured) return;

  const bookingId = lower(event.args.bookingId);
  if (bookingId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'logistics: event missing bookingId; skipping freight projection',
    );
    return;
  }

  if (event.eventName === 'Requested') {
    await deps.db.upsert<FreightRow>(
      'freight',
      {
        id: bookingId,
        batch_id: lower(event.args.batchId) ?? null,
        shipper: lower(event.args.shipper) ?? null,
        carrier: lower(event.args.carrier) ?? null,
        origin: null,
        destination: null,
        status: 'booked',
        eta: null,
        metadata: 'mode' in event.args ? { mode: event.args.mode } : {},
      },
      'id',
    );
    return;
  }

  if (event.eventName === 'Confirmed') {
    const existing = await deps.db.getBy<FreightRow>('freight', 'id', bookingId);
    if (existing === null) {
      deps.logger.warn(
        { event: event.eventName, bookingId },
        'logistics: Confirmed for unknown booking; audit-only',
      );
      return;
    }
    await deps.db.upsert<FreightRow>(
      'freight',
      { ...existing, eta: secondsToIso(event.args.eta) },
      'id',
    );
  }
};

export default makeHandler('logistics', projectLogistics, CONTRACTS);
