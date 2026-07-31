import { describe, it, expect } from "vitest";
import { createSupabaseStore } from "./supabase.js";
import { loadInfraConfig } from "./env.js";
import { isOk, isErr } from "./errors.js";

const emptyEnv = {} as NodeJS.ProcessEnv;

describe("Supabase store — no-op path (SUPABASE_URL unset)", () => {
  it("reports isConfigured=false and raw() is null", async () => {
    const store = await createSupabaseStore(loadInfraConfig(emptyEnv));
    expect(store.isConfigured).toBe(false);
    expect(store.raw()).toBeNull();
  });

  it("reads resolve to empty results without throwing", async () => {
    const store = await createSupabaseStore(loadInfraConfig(emptyEnv));

    const job = await store.getJob("00000000-0000-0000-0000-000000000000");
    expect(isOk(job)).toBe(true);
    if (isOk(job)) expect(job.data).toBeNull();

    const list = await store.listJobsByBatch(`0x${"0".repeat(64)}`);
    expect(isOk(list)).toBe(true);
    if (isOk(list)) expect(list.data).toEqual([]);

    const verdict = await store.getVerdict(`0x${"0".repeat(64)}`);
    expect(isOk(verdict)).toBe(true);
    if (isOk(verdict)) expect(verdict.data).toBeNull();

    const deal = await store.getDeal(`0x${"0".repeat(64)}`);
    expect(isOk(deal)).toBe(true);
    if (isOk(deal)) expect(deal.data).toBeNull();
  });

  it("writes resolve to a NOT_CONFIGURED error envelope (never throw)", async () => {
    const store = await createSupabaseStore(loadInfraConfig(emptyEnv));

    const jobWrite = await store.upsertJob({
      batchId: `0x${"a".repeat(64)}`,
      status: "queued",
      request: {},
    });
    expect(isErr(jobWrite)).toBe(true);
    if (isErr(jobWrite)) {
      expect(jobWrite.error.code).toBe("INFRA_NOT_CONFIGURED");
      expect(jobWrite.data).toBeNull();
    }

    const verdictWrite = await store.upsertVerdict({
      batchId: `0x${"a".repeat(64)}`,
      score: 9600,
      passed: true,
      threshold: 7000,
      findings: [],
      documentHashes: [],
      verdictHash: `0x${"b".repeat(64)}`,
      model: "claude-opus-4-8",
    });
    expect(isErr(verdictWrite)).toBe(true);
    if (isErr(verdictWrite)) expect(verdictWrite.error.code).toBe("INFRA_NOT_CONFIGURED");

    const dealWrite = await store.upsertDeal({
      batchId: `0x${"a".repeat(64)}`,
      buyer: `0x${"1".repeat(40)}`,
      supplier: `0x${"2".repeat(40)}`,
      token: `0x${"3".repeat(40)}`,
      amount: "1000000",
      state: "funded",
    });
    expect(isErr(dealWrite)).toBe(true);
    if (isErr(dealWrite)) expect(dealWrite.error.code).toBe("INFRA_NOT_CONFIGURED");
  });
});
