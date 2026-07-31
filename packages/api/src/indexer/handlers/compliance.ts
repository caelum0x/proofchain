/**
 * Compliance group handler.
 *
 * Owns the `src/compliance/*` contracts (sanctions, AML, trade-compliance,
 * certificates of origin / phytosanitary / halal, recalls, export licenses,
 * customs). All events land in the audit table; on top of that the three trade
 * certificate issuers project into the shared `certificates` read model, keyed by
 * the on-chain `certId` and tagged with a `kind` so the certificates page can
 * filter by type. Certificates are issue-only in the ABI, so there is no
 * transition branch (a future revocation event would add one, `settlement.ts`-style).
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';
import { lower, secondsToIso } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'SanctionsScreening',
  'AMLRegistry',
  'TradeComplianceEngine',
  'CertificateOfOrigin',
  'PhytosanitaryCertificate',
  'HalalCertification',
  'ProductRecallRegistry',
  'ExportLicenseRegistry',
  'DutyAndTariffCalculator',
  'CustomsDeclaration',
];

type CertificateRow = {
  id: string;
  kind: string;
  batch_id: string | null;
  holder: string | null;
  issuer: string | null;
  status: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
};

/** The certificate-issuing contracts and the `kind` they map to. */
const CERTIFICATE_KIND: Readonly<Record<string, string>> = Object.freeze({
  CertificateOfOrigin: 'origin',
  PhytosanitaryCertificate: 'phytosanitary',
  HalalCertification: 'halal',
});

const projectCompliance: Projector = async (
  event: DecodedEvent,
  deps: HandlerDeps,
) => {
  const kind = CERTIFICATE_KIND[event.contract];
  if (kind === undefined || event.eventName !== 'Issued') return; // audit-only
  if (!deps.db.isConfigured) return;

  const certId = lower(event.args.certId);
  if (certId === undefined) {
    deps.logger.warn(
      { contract: event.contract, tx: event.transactionHash },
      'compliance: Issued event missing certId; skipping certificate projection',
    );
    return;
  }

  // `issuer` on-chain is named `issuer` (origin) or `certifier` (halal); phyto
  // carries neither. Capture whichever is present, plus type-specific fields in
  // metadata so nothing is lost.
  const issuer = lower(event.args.issuer) ?? lower(event.args.certifier) ?? null;
  const metadata: Record<string, unknown> = {};
  for (const key of ['originCountry', 'destinationCountry', 'originType', 'treatment', 'standard']) {
    if (key in event.args && event.args[key] !== undefined) {
      metadata[key] = event.args[key];
    }
  }

  await deps.db.upsert<CertificateRow>(
    'certificates',
    {
      id: certId,
      kind,
      batch_id: lower(event.args.batchId) ?? null,
      holder: null,
      issuer,
      status: 'valid',
      expires_at: secondsToIso(event.args.expiry),
      metadata,
    },
    'id',
  );
};

export default makeHandler('compliance', projectCompliance, CONTRACTS);
