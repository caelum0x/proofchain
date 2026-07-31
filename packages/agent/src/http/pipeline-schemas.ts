/**
 * Zod request schemas for the domain-pipeline HTTP boundary. Each schema binds
 * the document array to the RUNTIME document cap (like the verify schema) and
 * extends a shared assessment body with the flow-specific fields. Nothing
 * reaches a pipeline without passing one of these.
 */
import { z } from 'zod';
import { bytes32Hex, inputDocumentSchema } from './schemas.js';
import { MAX_SCORE_BPS } from '../config/constants.js';

const unitFactor = z.number().min(0).max(1);
const nonNegInt = z.number().int().nonnegative();

/** The fields every pipeline request shares, bound to the document cap. */
export const buildAssessmentBodySchema = (maxDocuments: number) =>
  z.object({
    batchId: bytes32Hex,
    documents: z
      .array(inputDocumentSchema)
      .min(1, 'at least one document is required')
      .max(maxDocuments, 'too many documents'),
    modelScore: z.number().int().min(0).max(MAX_SCORE_BPS).optional(),
  });

export const buildFinancingBodySchema = (max: number) =>
  buildAssessmentBodySchema(max).extend({
    requestedAmount: z.number().nonnegative().optional(),
    currency: z.string().min(1).max(8).optional(),
  });

export const buildInsuranceBodySchema = (max: number) =>
  buildAssessmentBodySchema(max).extend({
    coverageAmount: z.number().positive('coverageAmount must be positive'),
    coverageType: z.enum(['cargo', 'parametric', 'credit']).optional(),
  });

export const buildDppBodySchema = (max: number) =>
  buildAssessmentBodySchema(max).extend({
    productId: z.string().min(1).max(128).optional(),
  });

export const buildComplianceBodySchema = (max: number) =>
  buildAssessmentBodySchema(max).extend({
    parties: z.array(z.string().min(1).max(256)).max(64).optional(),
    denylist: z.array(z.string().min(1).max(256)).max(2_048).optional(),
  });

export const buildQualityBodySchema = (max: number) =>
  buildAssessmentBodySchema(max).extend({
    metrics: z.record(z.number()).optional(),
  });

export const buildEsgBodySchema = (max: number) =>
  buildAssessmentBodySchema(max).extend({
    environmental: unitFactor.optional(),
    social: unitFactor.optional(),
    governance: unitFactor.optional(),
  });

export const buildCreditBodySchema = (max: number) =>
  buildAssessmentBodySchema(max).extend({
    history: z
      .object({
        totalDeliveries: nonNegInt.optional(),
        onTimeDeliveries: nonNegInt.optional(),
        defaults: nonNegInt.optional(),
      })
      .optional(),
  });

export const pipelineJobParamsSchema = z.object({
  id: z.string().uuid('job id must be a uuid'),
});
