import { describe, it, expect, vi, beforeEach } from "vitest";
import { isOk, isErr } from "./errors.js";

/**
 * Exercises the LIVE Supabase store by mocking `@supabase/supabase-js`. Verifies
 * row mapping (camelCase <-> snake_case), zod validation on read/write, and
 * error propagation — without any real database.
 */

// A programmable fake query builder. Terminal methods (single/maybeSingle/order)
// resolve to whatever `nextResult` is set to for the test.
type QueryResult = { data: unknown; error: { message: string } | null };
let nextResult: QueryResult = { data: null, error: null };
const calls: Array<{ table: string; op: string; payload?: unknown }> = [];

function makeBuilder(table: string) {
  const state: { op: string; payload?: unknown } = { op: "select" };
  const builder: Record<string, unknown> = {
    upsert(row: unknown) {
      state.op = "upsert";
      state.payload = row;
      calls.push({ table, op: "upsert", payload: row });
      return builder;
    },
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return Promise.resolve(nextResult);
    },
    single() {
      return Promise.resolve(nextResult);
    },
    maybeSingle() {
      return Promise.resolve(nextResult);
    },
  };
  return builder;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

const { createSupabaseStore } = await import("./supabase.js");
const { loadInfraConfig } = await import("./env.js");

const configured = loadInfraConfig({
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
} as NodeJS.ProcessEnv);

const B32 = `0x${"a".repeat(64)}`;
const ADDR = `0x${"1".repeat(40)}`;
const ISO = "2026-07-31T00:00:00.000Z";

beforeEach(() => {
  nextResult = { data: null, error: null };
  calls.length = 0;
});

describe("Supabase live store (mocked client)", () => {
  it("is configured and exposes a raw client", async () => {
    const store = await createSupabaseStore(configured);
    expect(store.isConfigured).toBe(true);
    expect(store.raw()).not.toBeNull();
  });

  it("upsertJob maps camelCase -> snake_case and back", async () => {
    nextResult = {
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        batch_id: B32,
        status: "queued",
        request: {},
        result: null,
        error: null,
        tx_hash: null,
        created_at: ISO,
        updated_at: ISO,
      },
      error: null,
    };
    const store = await createSupabaseStore(configured);
    const res = await store.upsertJob({ batchId: B32, status: "queued", request: {} });

    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.batchId).toBe(B32);
      expect(res.data.status).toBe("queued");
    }
    // Verify the row sent to the DB used snake_case.
    const row = calls.find((c) => c.op === "upsert")?.payload as Record<string, unknown>;
    expect(row.batch_id).toBe(B32);
    expect(row.tx_hash).toBeNull();
  });

  it("getVerdict returns null on empty result", async () => {
    nextResult = { data: null, error: null };
    const store = await createSupabaseStore(configured);
    const res = await store.getVerdict(B32);
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data).toBeNull();
  });

  it("getDeal maps a numeric amount to a string", async () => {
    nextResult = {
      data: {
        batch_id: B32,
        buyer: ADDR,
        supplier: ADDR,
        token: ADDR,
        amount: 1000000,
        state: "funded",
        tx_hash: null,
        created_at: ISO,
        updated_at: ISO,
      },
      error: null,
    };
    const store = await createSupabaseStore(configured);
    const res = await store.getDeal(B32);
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data?.amount).toBe("1000000");
  });

  it("listJobsByBatch returns mapped rows", async () => {
    nextResult = {
      data: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          batch_id: B32,
          status: "succeeded",
          request: {},
          result: { score: 9600 },
          error: null,
          tx_hash: null,
          created_at: ISO,
          updated_at: ISO,
        },
      ],
      error: null,
    };
    const store = await createSupabaseStore(configured);
    const res = await store.listJobsByBatch(B32);
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.status).toBe("succeeded");
    }
  });

  it("propagates DB errors as a structured SUPABASE envelope", async () => {
    nextResult = { data: null, error: { message: "permission denied" } };
    const store = await createSupabaseStore(configured);
    const res = await store.getJob("11111111-1111-1111-1111-111111111111");
    expect(isErr(res)).toBe(true);
    if (isErr(res)) {
      expect(res.error.code).toBe("INFRA_SUPABASE");
      expect(res.error.message).toBe("permission denied");
    }
  });

  it("rejects invalid input before hitting the DB (validation)", async () => {
    const store = await createSupabaseStore(configured);
    const res = await store.upsertVerdict({
      batchId: "0xnothex",
      score: 9600,
      passed: true,
      threshold: 7000,
      findings: [],
      documentHashes: [],
      verdictHash: B32,
      model: "m",
    } as never);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
    // No DB call should have been attempted.
    expect(calls.length).toBe(0);
  });

  it("flags a corrupt DB row as a validation error on read", async () => {
    nextResult = {
      data: { batch_id: "not-hex", score: 1, passed: true, threshold: 1, verdict_hash: B32, model: "m", created_at: ISO },
      error: null,
    };
    const store = await createSupabaseStore(configured);
    const res = await store.getVerdict(B32);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
  });
});
