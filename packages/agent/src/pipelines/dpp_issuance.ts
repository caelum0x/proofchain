/**
 * DPP-issuance pipeline (EU Digital Product Passport — the flagship angle).
 *
 * Assesses whether a batch carries enough verified provenance + documentation
 * to mint a compliant Digital Product Passport, computes a completeness score
 * over the mandatory data-carrier attributes, lists what is missing, and emits a
 * ready-to-mint passport draft when issuable.
 */
import { runAssessment, type AssessmentDeps, type AssessmentRequest } from './assessment.js';
import { registerPipeline } from './registry.js';
import { clampBps, hasCritical } from './decision.js';
import type { Finding } from '../shared.js';
import type { Hex } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface DppRequest extends AssessmentRequest {
  /** Optional product/GTIN identifier stamped onto the passport draft. */
  readonly productId?: string;
}

export interface PassportDraft {
  readonly batchId: Hex;
  readonly productId?: string;
  readonly supplier: Hex;
  readonly originHash: Hex;
  readonly metadataURI: string;
  readonly createdAt: number;
  readonly documentHashes: string[];
  readonly checkpointCount: number;
}

export interface DppResult {
  readonly batchId: Hex;
  readonly issuable: boolean;
  /** Fraction of mandatory attributes present (bps). */
  readonly completenessBps: number;
  readonly missing: string[];
  readonly passport: PassportDraft;
  readonly reasons: string[];
  readonly findings: Finding[];
  readonly risk: RiskAssessment[];
}

/** A named, mandatory passport attribute and whether the batch satisfies it. */
interface Attribute {
  readonly name: string;
  readonly present: boolean;
}

export const runDppIssuance = async (
  deps: AssessmentDeps,
  req: DppRequest,
): Promise<DppResult> => {
  const a = await runAssessment(deps, req);
  const { provenance, documents } = a;

  const attributes: Attribute[] = [
    { name: 'on_chain_batch', present: provenance.exists },
    {
      name: 'metadata_uri',
      present: provenance.metadataURI.trim().length > 0,
    },
    {
      name: 'origin_hash',
      present:
        provenance.originHash.toLowerCase() !== ZERO_HASH &&
        provenance.originHash.trim().length > 0,
    },
    { name: 'checkpoint_trail', present: provenance.checkpoints.length > 0 },
    { name: 'supporting_documents', present: documents.length > 0 },
    {
      name: 'supplier_identity',
      present: documents.some(
        (d) => (d.fields.supplierName ?? '').trim().length > 0,
      ),
    },
  ];

  const presentCount = attributes.filter((x) => x.present).length;
  const completenessBps = clampBps(
    (presentCount / attributes.length) * 10_000,
  );
  const missing = attributes.filter((x) => !x.present).map((x) => x.name);

  const reasons: string[] = [];
  let issuable = true;

  if (!provenance.exists) {
    issuable = false;
    reasons.push('Batch is not registered on-chain; a passport cannot be issued.');
  }
  if (hasCritical(a.findings)) {
    issuable = false;
    reasons.push('A critical finding blocks passport issuance.');
  }
  if (completenessBps < a.reconciliation.threshold) {
    issuable = false;
    reasons.push(
      `Data completeness ${completenessBps} bps is below the required ${a.reconciliation.threshold} bps.`,
    );
  }
  if (issuable) {
    reasons.push('Issuable: mandatory passport attributes are complete.');
  }

  const passport: PassportDraft = {
    batchId: a.batchId,
    ...(req.productId !== undefined ? { productId: req.productId } : {}),
    supplier: provenance.supplier,
    originHash: provenance.originHash,
    metadataURI: provenance.metadataURI,
    createdAt: provenance.createdAt,
    documentHashes: documents.map((d) => d.sha256),
    checkpointCount: provenance.checkpoints.length,
  };

  return {
    batchId: a.batchId,
    issuable,
    completenessBps,
    missing,
    passport,
    reasons,
    findings: a.findings,
    risk: a.risk,
  };
};

export const DPP_ISSUANCE_PIPELINE = registerPipeline<
  AssessmentDeps,
  DppRequest,
  DppResult
>({
  id: 'dpp_issuance',
  description:
    'EU Digital Product Passport issuance readiness: mandatory-attribute ' +
    'completeness score, missing-field list and a ready-to-mint passport draft.',
  run: runDppIssuance,
});
