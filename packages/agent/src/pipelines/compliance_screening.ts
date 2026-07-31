/**
 * Compliance-screening pipeline (sanctions / AML / trade compliance).
 *
 * Screens every party associated with a batch — request-supplied names, the
 * document parties (supplier/buyer/parties), and the on-chain supplier address —
 * against a caller-supplied denylist, and combines the deterministic outcome
 * with the batch's compliance findings and risk into a clear / review / blocked
 * status. A denylist hit is absolute (blocked); otherwise unresolved risk or a
 * failed verification routes the batch to manual review.
 */
import { runAssessment, type AssessmentDeps, type AssessmentRequest } from './assessment.js';
import { registerPipeline } from './registry.js';
import { defectMessages, hasCritical, hasSeverityAtLeast } from './decision.js';
import type { Finding } from '../shared.js';
import type { Hex } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

export type ScreeningStatus = 'clear' | 'review' | 'blocked';

export interface ComplianceRequest extends AssessmentRequest {
  /** Extra parties (names/addresses) to screen beyond the document parties. */
  readonly parties?: string[];
  /** Denylisted names/addresses (case-insensitive substring match). */
  readonly denylist?: string[];
}

export interface ScreeningHit {
  readonly party: string;
  readonly matched: string;
}

export interface ComplianceResult {
  readonly batchId: Hex;
  readonly status: ScreeningStatus;
  readonly screenedParties: string[];
  readonly hits: ScreeningHit[];
  readonly flags: string[];
  readonly reasons: string[];
  readonly findings: Finding[];
  readonly risk: RiskAssessment[];
}

const normalize = (s: string): string => s.trim().toLowerCase();

/** Collect the distinct, non-empty set of parties tied to the batch. */
const collectParties = (
  req: ComplianceRequest,
  documentParties: string[],
  supplier: Hex,
): string[] => {
  const all = [...(req.parties ?? []), ...documentParties, supplier];
  const seen = new Map<string, string>();
  for (const raw of all) {
    const value = raw.trim();
    if (value.length === 0) continue;
    const key = value.toLowerCase();
    if (!seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()];
};

export const runComplianceScreening = async (
  deps: AssessmentDeps,
  req: ComplianceRequest,
): Promise<ComplianceResult> => {
  const a = await runAssessment(deps, req);

  const documentParties = a.documents.flatMap((d) => [
    ...(d.fields.supplierName !== undefined ? [d.fields.supplierName] : []),
    ...(d.fields.buyerName !== undefined ? [d.fields.buyerName] : []),
    ...(d.fields.parties ?? []),
  ]);
  const screenedParties = collectParties(
    req,
    documentParties,
    a.provenance.supplier,
  );

  const denylist = (req.denylist ?? [])
    .map(normalize)
    .filter((d) => d.length > 0);
  const hits: ScreeningHit[] = [];
  for (const party of screenedParties) {
    const partyNorm = normalize(party);
    for (const entry of denylist) {
      if (partyNorm.includes(entry) || entry.includes(partyNorm)) {
        hits.push({ party, matched: entry });
      }
    }
  }

  const flags = [
    ...defectMessages(a.findings, 'medium'),
    ...a.risk.flatMap((r) =>
      r.level === 'high' || r.level === 'critical'
        ? [`risk:${r.model}=${r.level}`]
        : [],
    ),
  ];

  const reasons: string[] = [];
  let status: ScreeningStatus;
  if (hits.length > 0) {
    status = 'blocked';
    reasons.push(`${hits.length} denylist match(es); batch blocked.`);
  } else if (hasCritical(a.findings)) {
    status = 'blocked';
    reasons.push('A critical compliance finding blocks the batch.');
  } else if (hasSeverityAtLeast(a.findings, 'high') || !a.reconciliation.passed) {
    status = 'review';
    reasons.push('Outstanding findings or a failing score require manual review.');
  } else {
    status = 'clear';
    reasons.push('No denylist matches and no blocking findings.');
  }

  return {
    batchId: a.batchId,
    status,
    screenedParties,
    hits,
    flags,
    reasons,
    findings: a.findings,
    risk: a.risk,
  };
};

export const COMPLIANCE_SCREENING_PIPELINE = registerPipeline<
  AssessmentDeps,
  ComplianceRequest,
  ComplianceResult
>({
  id: 'compliance_screening',
  description:
    'Sanctions / AML / trade-compliance screening: denylist matching over all ' +
    'batch parties combined with compliance findings into clear/review/blocked.',
  run: runComplianceScreening,
});
