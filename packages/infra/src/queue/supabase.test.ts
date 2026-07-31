import { describe, it, expect } from "vitest";
import { createSupabaseJobQueue } from "./supabase.js";
import { isOk } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const fixedNow = () => Date.parse("2026-07-31T00:00:00Z");

describe("Supabase-backed job queue (fake client)", () => {
  it("enqueues, claims, completes, and reports stats", async () => {
    const fake = createFakeSupabase({ queue_jobs: [] });
    const q = createSupabaseJobQueue(fake.client as never, { now: fixedNow });

    const enq = await q.enqueue({ type: "verify", payload: { batchId: "0x1" } });
    expect(isOk(enq)).toBe(true);
    const id = isOk(enq) ? enq.data.id : "";
    if (isOk(enq)) expect(enq.data.status).toBe("pending");

    const claimed = await q.dequeue();
    expect(isOk(claimed)).toBe(true);
    if (isOk(claimed)) {
      expect(claimed.data?.status).toBe("processing");
      expect(claimed.data?.attempts).toBe(1);
    }

    const done = await q.complete(id, { ok: true });
    if (isOk(done)) expect(done.data.status).toBe("succeeded");

    const stats = await q.stats();
    if (isOk(stats)) expect(stats.data.succeeded).toBe(1);
  });

  it("dead-letters after exhausting retries", async () => {
    const fake = createFakeSupabase({ queue_jobs: [] });
    const q = createSupabaseJobQueue(fake.client as never, { now: fixedNow });
    const enq = await q.enqueue({ type: "t", maxAttempts: 1 });
    const id = isOk(enq) ? enq.data.id : "";

    await q.dequeue();
    const failed = await q.fail(id, { code: "X", message: "boom" });
    if (isOk(failed)) expect(failed.data.status).toBe("dead");
  });

  it("returns null when there is nothing to dequeue", async () => {
    const fake = createFakeSupabase({ queue_jobs: [] });
    const q = createSupabaseJobQueue(fake.client as never, { now: fixedNow });
    const res = await q.dequeue();
    if (isOk(res)) expect(res.data).toBeNull();
  });
});
