import { z } from "zod";
import { env } from "./env";
import { AppError, getErrorMessage } from "./errors";

/**
 * Typed client for the ProofChain backend API (`@proofchain/api`).
 *
 * Base URL comes from `NEXT_PUBLIC_API_URL`. Every response is validated with
 * zod at the boundary — we never trust the shape of an HTTP response. The API
 * wraps payloads in a `{ success, data, error }` envelope (optionally with a
 * `meta` block for pagination); this module unwraps + validates both.
 *
 * Page agents build their per-domain hooks on top of the small primitives here
 * (`apiGet`, `apiPost`, `apiList`, `buildQuery`). They should NOT need to touch
 * transport, envelope, or error handling — that all lives in this module.
 */

// ─── Envelope + pagination ──────────────────────────────────────────────────

/** Pagination metadata returned alongside list endpoints. */
export const pageMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

/** A validated list result: items plus pagination metadata. */
export interface ApiList<T> {
  readonly items: readonly T[];
  readonly meta: PageMeta;
}

const errorShapeSchema = z.union([
  z.string(),
  z.object({ code: z.string().optional(), message: z.string() }),
]);

/** The `{ success, data, error, meta? }` envelope every endpoint returns. */
const envelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().nullable().optional(),
  error: errorShapeSchema.nullable().optional(),
  meta: pageMetaSchema.nullable().optional(),
});

function envelopeError(error: unknown): string {
  if (!error) return "API request failed.";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "API request failed.";
}

// ─── Query-string helper ────────────────────────────────────────────────────

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Readonly<Record<string, QueryValue>>;

/**
 * Build a query string from a params object, skipping null/undefined/empty
 * values. Returns "" (no leading "?") when there is nothing to encode.
 */
export function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ─── Transport ──────────────────────────────────────────────────────────────

function baseUrl(): string {
  return env.apiUrl.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

interface RawEnvelope {
  readonly success: boolean;
  readonly data: unknown;
  readonly error?: unknown;
  readonly meta?: PageMeta | null;
}

/**
 * Perform a request and return the validated envelope (data still `unknown`).
 * Handles timeouts, network failures, non-JSON bodies, and the error envelope,
 * always throwing a structured {@link AppError} on failure.
 */
async function requestEnvelope(
  path: string,
  init?: RequestInit,
  timeoutMs = 30_000,
): Promise<RawEnvelope> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${normalizePath(path)}`, {
      ...init,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (cause) {
    clearTimeout(timer);
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new AppError("API_TIMEOUT", "The ProofChain API timed out.", { cause });
    }
    throw new AppError(
      "API_UNREACHABLE",
      `Cannot reach the ProofChain API: ${getErrorMessage(cause)}`,
      { cause },
    );
  }
  clearTimeout(timer);

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new AppError(
      "API_BAD_RESPONSE",
      `API returned a non-JSON response (HTTP ${response.status}).`,
      { cause },
    );
  }

  const envelope = envelopeSchema.safeParse(json);
  if (envelope.success) {
    if (!envelope.data.success) {
      throw new AppError("API_ERROR", envelopeError(envelope.data.error));
    }
    return {
      success: true,
      data: envelope.data.data ?? null,
      error: envelope.data.error,
      meta: envelope.data.meta ?? null,
    };
  }

  // Envelope missing but HTTP failed: surface the status.
  if (!response.ok) {
    throw new AppError("API_HTTP", `API request failed (HTTP ${response.status}).`);
  }

  // Some endpoints may return a bare (un-enveloped) body.
  return { success: true, data: json, meta: null };
}

// ─── Public primitives ──────────────────────────────────────────────────────

/**
 * GET a single resource and validate its `data` payload against `schema`.
 */
export async function apiGet<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  params?: QueryParams,
  timeoutMs?: number,
): Promise<z.infer<S>> {
  const env_ = await requestEnvelope(`${path}${buildQuery(params)}`, { method: "GET" }, timeoutMs);
  return parseData(schema, env_.data);
}

/**
 * POST a JSON body and validate the `data` payload against `schema`. Pass
 * `undefined` for `bodySchema`-less calls; `body` is JSON-serialised as-is.
 */
export async function apiPost<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  body?: unknown,
  timeoutMs?: number,
): Promise<z.infer<S>> {
  const env_ = await requestEnvelope(
    path,
    { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) },
    timeoutMs,
  );
  return parseData(schema, env_.data);
}

/**
 * GET a paginated list. `itemSchema` validates each element. Pagination `meta`
 * is read from the envelope when present, otherwise derived from the array so
 * callers always get a consistent {@link ApiList}.
 */
export async function apiList<S extends z.ZodTypeAny>(
  path: string,
  itemSchema: S,
  params?: QueryParams,
  timeoutMs?: number,
): Promise<ApiList<z.infer<S>>> {
  const env_ = await requestEnvelope(`${path}${buildQuery(params)}`, { method: "GET" }, timeoutMs);

  // Accept either `data: T[]` or `data: { items: T[] }`.
  const raw = env_.data;
  const rawItems = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : null;

  if (rawItems === null) {
    throw new AppError("API_SCHEMA", "Expected a list payload from the API.");
  }

  const items = parseData(z.array(itemSchema), rawItems) as z.infer<S>[];
  const meta: PageMeta = env_.meta ?? {
    total: items.length,
    page: 0,
    limit: items.length || 1,
  };
  return { items, meta };
}

function parseData<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("API_SCHEMA", "API response failed validation.", {
      details: parsed.error.message,
    });
  }
  return parsed.data;
}

// ─── Health + analytics (used by the landing page) ──────────────────────────

export const apiHealthSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]).or(z.string()),
  chainId: z.number().optional(),
  indexerBlock: z.union([z.number(), z.string()]).optional(),
  uptimeSeconds: z.number().optional(),
});
export type ApiHealth = z.infer<typeof apiHealthSchema>;

export async function getApiHealth(): Promise<ApiHealth> {
  return apiGet("/health", apiHealthSchema, undefined, 10_000);
}

/**
 * Network overview stats for the landing page. Every field is optional so the
 * client degrades gracefully if the backend adds/removes metrics — the UI only
 * renders what it recognises.
 */
export const networkStatsSchema = z.object({
  totalBatches: z.number().int().nonnegative().optional(),
  totalDeals: z.number().int().nonnegative().optional(),
  totalSuppliers: z.number().int().nonnegative().optional(),
  totalOrganizations: z.number().int().nonnegative().optional(),
  totalValueSettled: z.union([z.string(), z.number()]).optional(),
  totalFinanced: z.union([z.string(), z.number()]).optional(),
  activePolicies: z.number().int().nonnegative().optional(),
  openDisputes: z.number().int().nonnegative().optional(),
  carbonRetired: z.union([z.string(), z.number()]).optional(),
  passRateBps: z.number().int().min(0).max(10_000).optional(),
});
export type NetworkStats = z.infer<typeof networkStatsSchema>;

/**
 * Fetch aggregate network stats. Tries the analytics overview endpoint; returns
 * an empty object rather than throwing when the API is unreachable so the
 * landing page can render its static shell with placeholder stats.
 */
export async function getNetworkStats(): Promise<NetworkStats> {
  return apiGet("/analytics/overview", networkStatsSchema, undefined, 15_000);
}
