import { z } from "zod";
import { isBytes32 } from "./hashing";
import { ipfsToHttp } from "./format";
import { AppError, getErrorMessage } from "./errors";

/**
 * Verdict JSON schema — the structure the agent pins to IPFS and references via
 * `verdictURI` on-chain. Mirrors `VerificationVerdict` in @proofchain/shared.
 * Kept as a runtime zod schema so we can validate untrusted fetched documents.
 */

export const findingSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  message: z.string(),
  evidence: z.record(z.unknown()).optional(),
});

export const verdictSchema = z.object({
  batchId: z.string().refine(isBytes32, "invalid batchId"),
  score: z.number().int().min(0).max(10000),
  passed: z.boolean(),
  threshold: z.number().int().min(0).max(10000),
  findings: z.array(findingSchema),
  documentHashes: z.array(z.string()),
  verdictURI: z.string().optional(),
  createdAt: z.string(),
  model: z.string(),
});

export type Verdict = z.infer<typeof verdictSchema>;
export type FindingJson = z.infer<typeof findingSchema>;

/** Fetch and validate a verdict JSON document from an ipfs:// or http(s):// URI. */
export async function fetchVerdictJson(uri: string, signal?: AbortSignal): Promise<Verdict> {
  const url = ipfsToHttp(uri);
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (cause) {
    throw new AppError("VERDICT_UNREACHABLE", `Cannot fetch verdict: ${getErrorMessage(cause)}`, {
      cause,
    });
  }
  if (!response.ok) {
    throw new AppError("VERDICT_HTTP", `Verdict fetch failed (HTTP ${response.status}).`);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new AppError("VERDICT_BAD_JSON", "Verdict document is not valid JSON.", { cause });
  }
  const parsed = verdictSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError("VERDICT_SCHEMA", "Verdict document failed validation.", {
      details: parsed.error.message,
    });
  }
  return parsed.data;
}
