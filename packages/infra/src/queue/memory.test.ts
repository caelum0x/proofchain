import { describe, it, expect } from "vitest";
import { createMemoryJobQueue } from "./memory.js";
import { isOk, isErr } from "../errors.js";

function fixedClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function ids() {
  let n = 0;
  return () => `job-${(n += 1)}`;
}

describe("in-memory job queue", () => {
  it("enqueues, claims, and completes a job", async () => {
    const clk = fixedClock();
    const q = createMemoryJobQueue({ now: clk.now, newId: ids() });

    const enq = await q.enqueue({ type: "verify", payload: { batchId: "0x1" } });
    expect(isOk(enq)).toBe(true);
    if (isOk(enq)) expect(enq.data.status).toBe("pending");

    const claimed = await q.dequeue();
    expect(isOk(claimed)).toBe(true);
    if (isOk(claimed)) {
      expect(claimed.data?.status).toBe("processing");
      expect(claimed.data?.attempts).toBe(1);
    }

    const done = await q.complete("job-1", { ok: true });
    if (isOk(done)) {
      expect(done.data.status).toBe("succeeded");
      expect(done.data.result).toEqual({ ok: true });
    }

    // Nothing left to claim.
    const empty = await q.dequeue();
    if (isOk(empty)) expect(empty.data).toBeNull();
  });

  it("retries a failed job until maxAttempts, then dead-letters it", async () => {
    const clk = fixedClock();
    const q = createMemoryJobQueue({ now: clk.now, newId: ids() });
    await q.enqueue({ type: "t", maxAttempts: 2 });

    await q.dequeue();
    const retry = await q.fail("job-1", { code: "X", message: "boom" }, { retryDelayMs: 100 });
    if (isOk(retry)) {
      expect(retry.data.status).toBe("pending");
      expect(retry.data.attempts).toBe(1);
    }
    // Not runnable yet (runAt is in the future).
    const notYet = await q.dequeue();
    if (isOk(notYet)) expect(notYet.data).toBeNull();

    clk.advance(100);
    const claimedAgain = await q.dequeue();
    if (isOk(claimedAgain)) expect(claimedAgain.data?.attempts).toBe(2);

    const dead = await q.fail("job-1", { code: "X", message: "boom again" });
    if (isOk(dead)) expect(dead.data.status).toBe("dead");
  });

  it("reports stats and errors on unknown ids", async () => {
    const q = createMemoryJobQueue({ newId: ids() });
    await q.enqueue({ type: "a" });
    await q.enqueue({ type: "b" });
    const stats = await q.stats();
    if (isOk(stats)) expect(stats.data.pending).toBe(2);

    const missing = await q.complete("nope");
    expect(isErr(missing)).toBe(true);
  });

  it("does not claim jobs scheduled in the future", async () => {
    const clk = fixedClock();
    const q = createMemoryJobQueue({ now: clk.now, newId: ids() });
    await q.enqueue({ type: "later", runAt: new Date(clk.now() + 5000).toISOString() });
    const res = await q.dequeue();
    if (isOk(res)) expect(res.data).toBeNull();
    clk.advance(5000);
    const res2 = await q.dequeue();
    if (isOk(res2)) expect(res2.data?.type).toBe("later");
  });
});
