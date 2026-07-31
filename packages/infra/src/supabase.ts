/**
 * Typed Supabase client wrapper for the ProofChain read/write models.
 *
 * Graceful degradation is a first-class requirement: when `SUPABASE_URL` (or the
 * service-role key) is not configured, `createSupabaseStore()` returns a client
 * whose `isConfigured` flag is `false`. Reads then resolve to empty results and
 * writes resolve to a structured `NOT_CONFIGURED` error envelope — never a throw
 * and never a crash — so callers (e.g. the agent) can fall back to in-memory
 * state without special-casing a missing dependency.
 *
 * The real `@supabase/supabase-js` module is imported lazily, so nothing here
 * requires the dependency to be installed when running unconfigured.
 *
 * Every value crossing the DB boundary is validated with zod (types.ts), so a
 * corrupt row can never silently propagate into the app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadInfraConfig, type InfraConfig } from "./env.js";
import {
  InfraErrorCode,
  ok,
  err,
  toEnvelope,
  type ErrorEnvelope,
  type Result,
} from "./errors.js";
import {
  Deal,
  DealInput,
  Job,
  JobInput,
  Verdict,
  VerdictInput,
  type Deal as DealT,
  type DealInput as DealInputT,
  type Job as JobT,
  type JobInput as JobInputT,
  type Verdict as VerdictT,
  type VerdictInput as VerdictInputT,
} from "./types.js";

export interface SupabaseStore {
  readonly isConfigured: boolean;

  // jobs
  upsertJob(input: JobInputT): Promise<Result<JobT>>;
  getJob(id: string): Promise<Result<JobT | null>>;
  listJobsByBatch(batchId: string): Promise<Result<readonly JobT[]>>;

  // verdicts
  upsertVerdict(input: VerdictInputT): Promise<Result<VerdictT>>;
  getVerdict(batchId: string): Promise<Result<VerdictT | null>>;

  // deals
  upsertDeal(input: DealInputT): Promise<Result<DealT>>;
  getDeal(batchId: string): Promise<Result<DealT | null>>;

  /** Underlying client, or null when unconfigured. Escape hatch for advanced use. */
  raw(): SupabaseClient | null;
}

const NOT_CONFIGURED_MSG =
  "Supabase is not configured (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY); operation skipped.";

/**
 * Create a Supabase store from the resolved config (defaults to `process.env`).
 * Returns a no-op store when Supabase is not configured.
 */
export async function createSupabaseStore(
  config: InfraConfig = loadInfraConfig(),
): Promise<SupabaseStore> {
  if (!config.supabase.configured) {
    return createNoopStore();
  }

  // Lazy import so the dependency is only required when actually configured.
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return createLiveStore(client);
}

// -----------------------------------------------------------------------------
// No-op store
// -----------------------------------------------------------------------------

function createNoopStore(): SupabaseStore {
  const writeErr = <T>(): Result<T> =>
    err<T>(InfraErrorCode.NOT_CONFIGURED, NOT_CONFIGURED_MSG);

  return {
    isConfigured: false,
    async upsertJob() {
      return writeErr<JobT>();
    },
    async getJob() {
      return ok<JobT | null>(null);
    },
    async listJobsByBatch() {
      return ok<readonly JobT[]>([]);
    },
    async upsertVerdict() {
      return writeErr<VerdictT>();
    },
    async getVerdict() {
      return ok<VerdictT | null>(null);
    },
    async upsertDeal() {
      return writeErr<DealT>();
    },
    async getDeal() {
      return ok<DealT | null>(null);
    },
    raw() {
      return null;
    },
  };
}

// -----------------------------------------------------------------------------
// Live store
// -----------------------------------------------------------------------------

function createLiveStore(client: SupabaseClient): SupabaseStore {
  return {
    isConfigured: true,

    async upsertJob(input: JobInputT): Promise<Result<JobT>> {
      const parsed = JobInput.safeParse(input);
      if (!parsed.success) return validationErr<JobT>("job", parsed.error.issues);
      return upsertOne<JobT>(client, "jobs", jobToRow(parsed.data), "id", Job, jobFromRow);
    },

    async getJob(id: string): Promise<Result<JobT | null>> {
      return getOne<JobT>(client, "jobs", "id", id, Job, jobFromRow);
    },

    async listJobsByBatch(batchId: string): Promise<Result<readonly JobT[]>> {
      try {
        const { data, error } = await client
          .from("jobs")
          .select("*")
          .eq("batch_id", batchId)
          .order("created_at", { ascending: false });
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { batchId });
        const rows = (data ?? []) as unknown[];
        const parsed: JobT[] = [];
        for (const row of rows) {
          const p = Job.safeParse(jobFromRow(row as Record<string, unknown>));
          if (!p.success) return validationErr<readonly JobT[]>("job", p.error.issues);
          parsed.push(p.data);
        }
        return ok<readonly JobT[]>(parsed);
      } catch (error) {
        return err(InfraErrorCode.SUPABASE, "listJobsByBatch failed", {
          cause: toEnvelope(error),
        });
      }
    },

    async upsertVerdict(input: VerdictInputT): Promise<Result<VerdictT>> {
      const parsed = VerdictInput.safeParse(input);
      if (!parsed.success) return validationErr<VerdictT>("verdict", parsed.error.issues);
      return upsertOne<VerdictT>(
        client,
        "verdicts",
        verdictToRow(parsed.data),
        "batch_id",
        Verdict,
        verdictFromRow,
      );
    },

    async getVerdict(batchId: string): Promise<Result<VerdictT | null>> {
      return getOne<VerdictT>(client, "verdicts", "batch_id", batchId, Verdict, verdictFromRow);
    },

    async upsertDeal(input: DealInputT): Promise<Result<DealT>> {
      const parsed = DealInput.safeParse(input);
      if (!parsed.success) return validationErr<DealT>("deal", parsed.error.issues);
      return upsertOne<DealT>(
        client,
        "deals",
        dealToRow(parsed.data),
        "batch_id",
        Deal,
        dealFromRow,
      );
    },

    async getDeal(batchId: string): Promise<Result<DealT | null>> {
      return getOne<DealT>(client, "deals", "batch_id", batchId, Deal, dealFromRow);
    },

    raw() {
      return client;
    },
  };
}

// -----------------------------------------------------------------------------
// Generic query helpers
// -----------------------------------------------------------------------------

type RowMapper<T> = (row: Record<string, unknown>) => unknown;
type Validator<T> = { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } } };

async function upsertOne<T>(
  client: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  conflictKey: string,
  validator: Validator<T>,
  fromRow: RowMapper<T>,
): Promise<Result<T>> {
  try {
    const { data, error } = await client
      .from(table)
      .upsert(row, { onConflict: conflictKey })
      .select("*")
      .single();
    if (error) return err(InfraErrorCode.SUPABASE, error.message, { table });
    const parsed = validator.safeParse(fromRow(data as Record<string, unknown>));
    if (!parsed.success) return validationErr<T>(table, parsed.error.issues);
    return ok(parsed.data);
  } catch (error) {
    return err(InfraErrorCode.SUPABASE, `upsert into ${table} failed`, {
      cause: toEnvelope(error),
    });
  }
}

async function getOne<T>(
  client: SupabaseClient,
  table: string,
  keyColumn: string,
  keyValue: string,
  validator: Validator<T>,
  fromRow: RowMapper<T>,
): Promise<Result<T | null>> {
  try {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq(keyColumn, keyValue)
      .maybeSingle();
    if (error) return err(InfraErrorCode.SUPABASE, error.message, { table, keyValue });
    if (data === null || data === undefined) return ok<T | null>(null);
    const parsed = validator.safeParse(fromRow(data as Record<string, unknown>));
    if (!parsed.success) return validationErr<T | null>(table, parsed.error.issues);
    return ok<T | null>(parsed.data);
  } catch (error) {
    return err(InfraErrorCode.SUPABASE, `select from ${table} failed`, {
      cause: toEnvelope(error),
    });
  }
}

function validationErr<T>(entity: string, issues: unknown): Result<T> {
  return err<T>(InfraErrorCode.VALIDATION, `Invalid ${entity} payload`, {
    issues,
  });
}

// -----------------------------------------------------------------------------
// Row mappers (camelCase <-> snake_case). Explicit to keep the DB contract clear.
// -----------------------------------------------------------------------------

function jobToRow(job: JobInputT): Record<string, unknown> {
  const row: Record<string, unknown> = {
    batch_id: job.batchId,
    status: job.status,
    request: job.request,
    result: job.result ?? null,
    error: job.error ?? null,
    tx_hash: job.txHash ?? null,
  };
  if (job.id !== undefined) row.id = job.id;
  return row;
}

function jobFromRow(row: Record<string, unknown>): unknown {
  return {
    id: row.id,
    batchId: row.batch_id,
    status: row.status,
    request: row.request ?? {},
    result: row.result ?? null,
    error: row.error ?? null,
    txHash: row.tx_hash ?? null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

function verdictToRow(v: VerdictInputT): Record<string, unknown> {
  return {
    batch_id: v.batchId,
    score: v.score,
    passed: v.passed,
    threshold: v.threshold,
    findings: v.findings,
    document_hashes: v.documentHashes,
    verdict_hash: v.verdictHash,
    verdict_uri: v.verdictUri ?? null,
    model: v.model,
  };
}

function verdictFromRow(row: Record<string, unknown>): unknown {
  return {
    batchId: row.batch_id,
    score: row.score,
    passed: row.passed,
    threshold: row.threshold,
    findings: row.findings ?? [],
    documentHashes: row.document_hashes ?? [],
    verdictHash: row.verdict_hash,
    verdictUri: row.verdict_uri ?? null,
    model: row.model,
    createdAt: normalizeTimestamp(row.created_at),
  };
}

function dealToRow(d: DealInputT): Record<string, unknown> {
  return {
    batch_id: d.batchId,
    buyer: d.buyer,
    supplier: d.supplier,
    token: d.token,
    amount: d.amount,
    state: d.state,
    tx_hash: d.txHash ?? null,
  };
}

function dealFromRow(row: Record<string, unknown>): unknown {
  return {
    batchId: row.batch_id,
    buyer: row.buyer,
    supplier: row.supplier,
    token: row.token,
    // numeric columns come back as string from PostgREST — keep as string.
    amount: row.amount === undefined || row.amount === null ? undefined : String(row.amount),
    state: row.state,
    txHash: row.tx_hash ?? null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

/** PostgREST returns ISO strings already; guard against Date instances too. */
function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export type { ErrorEnvelope };
