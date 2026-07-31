/**
 * Risk model registry.
 *
 * A `RiskModel` scores ONE risk lens (fraud, credit, counterparty, route, esg)
 * over the verification context, independently of the pass/fail score. Risk
 * assessments are advisory: they enrich the verdict/pipeline output (e.g. for
 * financing-eligibility or insurance-underwriting flows) without gating the base
 * attestation.
 *
 * REGISTRATION CONVENTION
 *   Create `src/risk/<model>.ts` that builds a `RiskModel` and calls
 *   `registerRiskModel(...)`, then append a side-effect import to
 *   `src/risk/index.ts`. Never edit this file.
 */
import { createRegistry } from '../registry/registry.js';
import type { Finding } from '../shared.js';
import type { ParsedDocument, ProvenanceData } from '../domain/types.js';

export interface RiskContext {
  readonly modelScore: number;
  readonly findings: readonly Finding[];
  readonly documents: readonly ParsedDocument[];
  readonly provenance: ProvenanceData;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  /** The risk model id that produced this assessment. */
  readonly model: string;
  /** Risk score in basis points, 0..10000, higher = MORE risk. */
  readonly score: number;
  readonly level: RiskLevel;
  /** Named contributing factors, for explainability. */
  readonly factors: readonly string[];
}

export interface RiskModel {
  /** Unique model id AND registry key, e.g. "fraud". */
  readonly id: string;
  readonly description: string;
  assess(ctx: RiskContext): RiskAssessment;
}

export const riskRegistry = createRegistry<RiskModel>({
  label: 'risk-model',
  keyOf: (m) => m.id,
});

/** Register a risk model (called by each `src/risk/<model>.ts` module). */
export const registerRiskModel = (model: RiskModel): RiskModel =>
  riskRegistry.register(model);

/** Map a 0..10000 risk score to a coarse level. */
export const riskLevel = (score: number): RiskLevel => {
  if (score >= 7_500) return 'critical';
  if (score >= 5_000) return 'high';
  if (score >= 2_500) return 'medium';
  return 'low';
};

/** Run every registered risk model over the context. */
export const assessRisk = (ctx: RiskContext): RiskAssessment[] =>
  riskRegistry.all().map((model) => model.assess(ctx));
