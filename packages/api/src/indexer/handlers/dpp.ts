/**
 * Digital Product Passport (DPP) group handler — the flagship EU-DPP module.
 *
 * Owns `src/dpp/*` (passport ERC721, lifecycle registry, material composition,
 * repairability, recycling, data carrier, compliance oracle). Beyond the audit
 * table, it projects the DigitalProductPassport token lifecycle into the
 * `passports` read model: `PassportIssued` establishes the row, `StatusChanged`
 * transitions it. The on-chain `PassportStatus` enum is mapped to the read-model
 * status vocabulary; unmapped statuses stay audit-only (row untouched).
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';
import { asNumber, lower, str } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'DigitalProductPassport',
  'DPPLifecycleRegistry',
  'MaterialComposition',
  'RepairabilityIndex',
  'RecyclingRegistry',
  'DPPDataCarrier',
  'DPPComplianceOracle',
];

type PassportRow = {
  token_id: string;
  batch_id: string | null;
  owner: string | null;
  product_name: string | null;
  status: string;
  data_uri: string | null;
  metadata: Record<string, unknown>;
};

/**
 * On-chain `PassportStatus` enum value → read-model status (only the subset the
 * `passports` CHECK constraint can represent). Numeric values mirror the Solidity
 * enum order (`None=0, Active=1, Suspended=2, Recalled=3, Retired=4`).
 */
const STATUS_TOKEN: Readonly<Record<number, string>> = Object.freeze({
  1: 'active',
  4: 'retired',
});

const projectDpp: Projector = async (event: DecodedEvent, deps: HandlerDeps) => {
  const contract: string = event.contract; // widen for sound literal comparison
  if (contract !== 'DigitalProductPassport') return; // audit-only otherwise
  if (!deps.db.isConfigured) return;

  const tokenId = str(event.args.tokenId);
  if (tokenId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'dpp: event missing tokenId; skipping passport projection',
    );
    return;
  }

  if (event.eventName === 'PassportIssued') {
    await deps.db.upsert<PassportRow>(
      'passports',
      {
        token_id: tokenId,
        batch_id: lower(event.args.batchId) ?? null,
        owner: lower(event.args.manufacturer) ?? null,
        product_name: null,
        status: 'issued',
        data_uri: null,
        metadata: 'gtin' in event.args ? { gtin: event.args.gtin } : {},
      },
      'token_id',
    );
    return;
  }

  if (event.eventName === 'StatusChanged') {
    const nextStatus = STATUS_TOKEN[asNumber(event.args.status) ?? -1];
    if (nextStatus === undefined) return; // status not representable in read model
    const existing = await deps.db.getBy<PassportRow>('passports', 'token_id', tokenId);
    if (existing === null) {
      deps.logger.warn(
        { event: event.eventName, tokenId },
        'dpp: StatusChanged for unknown passport; audit-only',
      );
      return;
    }
    await deps.db.upsert<PassportRow>(
      'passports',
      { ...existing, status: nextStatus },
      'token_id',
    );
  }
};

export default makeHandler('dpp', projectDpp, CONTRACTS);
