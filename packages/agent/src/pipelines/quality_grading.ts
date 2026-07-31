/**
 * Quality-grading pipeline.
 *
 * Assigns a letter grade (A–F) to a batch by blending the reconciled
 * verification score with any caller-supplied measured quality metrics
 * (normalised 0..1, e.g. moisture, defect-free ratio, grade purity) and
 * penalising outstanding quality findings. Deterministic and monotonic: cleaner
 * verification + better metrics can only improve the grade.
 */
import { runAssessment, type AssessmentDeps, type AssessmentRequest } from './assessment.js';
import { registerPipeline } from './registry.js';
import {
  clampBps,
  countAtLeast,
  defectMessages,
  qualityGrade,
  unitToBps,
  weightedBps,
  type QualityGrade,
} from './decision.js';
import type { Finding } from '../shared.js';
import type { Hex } from '../domain/types.js';
import type { RiskAssessment } from '../risk/registry.js';

/** Penalty (bps) subtracted per finding at/above `medium`. */
const DEFECT_PENALTY_BPS = 400;

export interface QualityRequest extends AssessmentRequest {
  /** Named measured metrics, each normalised to 0..1 (1 = best). */
  readonly metrics?: Record<string, number>;
}

export interface QualityResult {
  readonly batchId: Hex;
  readonly grade: QualityGrade;
  readonly gradeScore: number;
  readonly metricsScore?: number;
  readonly defects: string[];
  readonly reasons: string[];
  readonly findings: Finding[];
  readonly risk: RiskAssessment[];
}

/** Average of the supplied metric values in bps, or undefined when none. */
const metricsToBps = (
  metrics: Record<string, number> | undefined,
): number | undefined => {
  if (metrics === undefined) return undefined;
  const values = Object.values(metrics);
  if (values.length === 0) return undefined;
  const avg = values.reduce((acc, v) => acc + unitToBps(v), 0) / values.length;
  return clampBps(avg);
};

export const runQualityGrading = async (
  deps: AssessmentDeps,
  req: QualityRequest,
): Promise<QualityResult> => {
  const a = await runAssessment(deps, req);
  const verificationBps = a.reconciliation.finalScore;
  const metricsScore = metricsToBps(req.metrics);

  // Blend verification integrity with measured quality (equal weight when both
  // present); then subtract a penalty for each material defect finding.
  const blended = weightedBps([
    [verificationBps, 1],
    [metricsScore ?? 0, metricsScore !== undefined ? 1 : 0],
  ]);
  const defectCount = countAtLeast(a.findings, 'medium');
  const gradeScore = clampBps(blended - defectCount * DEFECT_PENALTY_BPS);
  const grade = qualityGrade(gradeScore);
  const defects = defectMessages(a.findings, 'medium');

  const reasons: string[] = [
    `Grade ${grade} (${gradeScore} bps) from verification ${verificationBps} bps` +
      (metricsScore !== undefined ? ` and metrics ${metricsScore} bps` : '') +
      (defectCount > 0 ? ` less ${defectCount} defect(s)` : '') +
      '.',
  ];

  return {
    batchId: a.batchId,
    grade,
    gradeScore,
    ...(metricsScore !== undefined ? { metricsScore } : {}),
    defects,
    reasons,
    findings: a.findings,
    risk: a.risk,
  };
};

export const QUALITY_GRADING_PIPELINE = registerPipeline<
  AssessmentDeps,
  QualityRequest,
  QualityResult
>({
  id: 'quality_grading',
  description:
    'Batch quality grade (A–F): blends verification score with measured ' +
    'quality metrics and penalises material defect findings.',
  run: runQualityGrading,
});
