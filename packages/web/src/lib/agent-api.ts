import { z } from "zod";
import { env } from "./env";
import { AppError, getErrorMessage } from "./errors";
import { isBytes32 } from "./hashing";
import { verdictSchema, type Verdict } from "./verdict";

/**
 * Typed client for the @proofchain/agent verification API.
 * Base URL comes from NEXT_PUBLIC_AGENT_API_URL. All responses are validated
 * with zod at the boundary — we never trust the shape of an HTTP response.
 */

export type { Verdict };

const verifyResultSchema = z.object({
  verdict: verdictSchema,
  txHash: z.string().optional(),
  jobId: z.string().optional(),
});
export type VerifyResult = z.infer<typeof verifyResultSchema>;

const jobSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  verdict: verdictSchema.optional(),
  error: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Job = z.infer<typeof jobSchema>;

const healthSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]).or(z.string()),
  chainId: z.number().optional(),
  rpcOk: z.boolean().optional(),
});
export type Health = z.infer<typeof healthSchema>;

/** The agent wraps payloads in a { success, data, error } envelope. */
const envelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().nullable().optional(),
  error: z
    .union([z.string(), z.object({ code: z.string().optional(), message: z.string() })])
    .nullable()
    .optional(),
});

export interface AgentDocumentInput {
  readonly name: string;
  readonly mimeType: string;
  readonly dataBase64?: string;
  readonly url?: string;
}

function baseUrl(): string {
  return env.agentApiUrl.replace(/\/+$/, "");
}

function envelopeError(error: unknown): string {
  if (!error) return "Agent request failed.";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Agent request failed.";
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit,
  timeoutMs = 120_000,
): Promise<z.infer<S>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (cause) {
    clearTimeout(timer);
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new AppError("AGENT_TIMEOUT", "The verification agent timed out.");
    }
    throw new AppError("AGENT_UNREACHABLE", `Cannot reach the agent API: ${getErrorMessage(cause)}`, {
      cause,
    });
  }
  clearTimeout(timer);

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new AppError(
      "AGENT_BAD_RESPONSE",
      `Agent returned a non-JSON response (HTTP ${response.status}).`,
      { cause },
    );
  }

  const envelope = envelopeSchema.safeParse(json);
  if (envelope.success) {
    if (!envelope.data.success) {
      throw new AppError("AGENT_ERROR", envelopeError(envelope.data.error));
    }
    const parsed = schema.safeParse(envelope.data.data);
    if (!parsed.success) {
      throw new AppError("AGENT_SCHEMA", "Agent response failed validation.", {
        details: parsed.error.message,
      });
    }
    return parsed.data;
  }

  // Fall back to a bare (un-enveloped) body.
  if (!response.ok) {
    throw new AppError("AGENT_HTTP", `Agent request failed (HTTP ${response.status}).`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AppError("AGENT_SCHEMA", "Agent response failed validation.", {
      details: parsed.error.message,
    });
  }
  return parsed.data;
}

export async function requestVerification(
  batchId: string,
  documents: readonly AgentDocumentInput[],
): Promise<VerifyResult> {
  if (!isBytes32(batchId)) {
    throw new AppError("INVALID_BATCH_ID", "Batch id must be a 32-byte hex value.");
  }
  if (documents.length === 0) {
    throw new AppError("NO_DOCUMENTS", "Attach at least one document to verify.");
  }
  return request(
    "/verify",
    verifyResultSchema,
    { method: "POST", body: JSON.stringify({ batchId, documents }) },
  );
}

export async function getJob(id: string): Promise<Job> {
  if (!id) throw new AppError("INVALID_JOB_ID", "Job id is required.");
  return request(`/jobs/${encodeURIComponent(id)}`, jobSchema, { method: "GET" }, 20_000);
}

export async function getHealth(): Promise<Health> {
  return request("/health", healthSchema, { method: "GET" }, 10_000);
}

/** Read a File into a base64 string (no data: prefix). */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
