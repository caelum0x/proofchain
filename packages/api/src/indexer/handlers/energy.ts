/**
 * Energy / ESG group handler.
 *
 * Owns `src/energy/*` (renewable-energy certificates, emissions trading, water &
 * biodiversity credits, green bonds). Beyond the audit table it projects the
 * RenewableEnergyCertificate (ERC1155) lifecycle into `renewable_certificates`:
 * `CertificateIssued` establishes the REC batch (MWh, source, vintage);
 * `CertificateRetired` transitions it to `retired` and records the retiring
 * account. The on-chain event carries no issuer field, so the issuing contract
 * address stands in as `issuer` (satisfying the NOT NULL read-model column).
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';
import { asNumber, enumToken, lower, str } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'RenewableEnergyCertificate',
  'EmissionsTrading',
  'WaterCredit',
  'BiodiversityCredit',
  'GreenBondIssuer',
];

/**
 * On-chain `EnergySource` enum value → label. Numeric values mirror the Solidity
 * enum order (`Solar=0 … Nuclear=5`); {@link enumToken} lowercases the label to
 * the `renewable_certificates.energy_source` CHECK vocabulary.
 */
const ENERGY_SOURCE_LABELS: Readonly<Record<number, string>> = Object.freeze({
  0: 'Solar',
  1: 'Wind',
  2: 'Hydro',
  3: 'Geothermal',
  4: 'Biomass',
  5: 'Nuclear',
});

type RecRow = {
  id: string;
  token_id: string | null;
  issuer: string;
  owner: string | null;
  energy_source: string;
  mwh: string;
  facility: string | null;
  vintage_year: number | null;
  status: string;
  metadata: Record<string, unknown>;
};

const projectEnergy: Projector = async (
  event: DecodedEvent,
  deps: HandlerDeps,
) => {
  const contract: string = event.contract; // widen for sound literal comparison
  if (contract !== 'RenewableEnergyCertificate') return; // audit-only otherwise
  if (!deps.db.isConfigured) return;

  const tokenId = str(event.args.tokenId);
  if (tokenId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'energy: event missing tokenId; skipping REC projection',
    );
    return;
  }

  if (event.eventName === 'CertificateIssued') {
    const mwh = str(event.args.mwh);
    if (mwh === undefined) {
      deps.logger.warn(
        { event: event.eventName, tx: event.transactionHash },
        'energy: CertificateIssued missing mwh; skipping REC projection',
      );
      return;
    }
    await deps.db.upsert<RecRow>(
      'renewable_certificates',
      {
        id: tokenId,
        token_id: tokenId,
        issuer: event.address.toLowerCase(),
        owner: null,
        energy_source: enumToken(ENERGY_SOURCE_LABELS, event.args.source, 'solar'),
        mwh,
        facility: str(event.args.facilityId) ?? null,
        vintage_year: asNumber(event.args.vintageYear) ?? null,
        status: 'issued',
        metadata: {},
      },
      'id',
    );
    return;
  }

  if (event.eventName === 'CertificateRetired') {
    const existing = await deps.db.getBy<RecRow>('renewable_certificates', 'id', tokenId);
    if (existing === null) {
      deps.logger.warn(
        { event: event.eventName, tokenId },
        'energy: CertificateRetired for unknown REC; audit-only',
      );
      return;
    }
    await deps.db.upsert<RecRow>(
      'renewable_certificates',
      { ...existing, status: 'retired', owner: lower(event.args.account) ?? existing.owner },
      'id',
    );
  }
};

export default makeHandler('energy', projectEnergy, CONTRACTS);
