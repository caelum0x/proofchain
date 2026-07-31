/**
 * Request validation schemas (zod) for every HTTP boundary. Nothing enters the
 * pipeline without passing through one of these.
 */
import { z } from 'zod';
import { DEFAULT_MAX_DOCUMENTS } from '../config/constants.js';

export const bytes32Hex = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex string');

export const inputDocumentSchema = z
  .object({
    name: z.string().min(1).max(256),
    mimeType: z.string().min(1).max(128),
    dataBase64: z.string().min(1).optional(),
    url: z.string().url().optional(),
  })
  .refine((d) => d.dataBase64 !== undefined || d.url !== undefined, {
    message: 'each document must provide either dataBase64 or url',
  });

/**
 * Build the verify body schema bound to a RUNTIME document cap. The route wires
 * this with `config.MAX_DOCUMENTS` so lowering the env limit is actually
 * enforced (rather than the compile-time `DEFAULT_MAX_DOCUMENTS` constant).
 */
export const buildVerifyBodySchema = (maxDocuments: number) =>
  z.object({
    batchId: bytes32Hex,
    documents: z
      .array(inputDocumentSchema)
      .min(1, 'at least one document is required')
      .max(maxDocuments, 'too many documents'),
  });

/** Default-bounded schema (absolute cap) for consumers without runtime config. */
export const verifyBodySchema = buildVerifyBodySchema(DEFAULT_MAX_DOCUMENTS);

export type VerifyBody = z.infer<typeof verifyBodySchema>;

export const jobParamsSchema = z.object({
  id: z.string().uuid('job id must be a uuid'),
});

export type JobParams = z.infer<typeof jobParamsSchema>;
