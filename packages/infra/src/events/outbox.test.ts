import { describe, it, expect } from "vitest";
import { createMemoryOutbox, createSupabaseOutbox, drain } from "./outbox.js";
import { isOk } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

function ids() {
  let n = 0;
  return () => `evt-${(n += 1)}`;
}

const append = (aggregateId: string) => ({
  aggregate: "deal",
  aggregateId,
  type: "deal.funded",
  payload: { amount: "1" },
});

describe("in-memory outbox + relay", () => {
  it("appends, lists pending, and drains published events", async () => {
    const outbox = createMemoryOutbox({ newId: ids() });
    await outbox.append(append("0xa"));
    await outbox.append(append("0xb"));

    const pending = await outbox.pending();
    if (isOk(pending)) expect(pending.data).toHaveLength(2);

    const published: string[] = [];
    const result = await drain(outbox, (e) => {
      published.push(e.aggregateId);
    });
    if (isOk(result)) {
      expect(result.data.published).toBe(2);
      expect(result.data.failed).toBe(0);
    }
    expect(published).toEqual(["0xa", "0xb"]);

    const afterPending = await outbox.pending();
    if (isOk(afterPending)) expect(afterPending.data).toHaveLength(0);
  });

  it("marks an event failed when the publisher throws", async () => {
    const outbox = createMemoryOutbox({ newId: ids() });
    await outbox.append(append("0xa"));
    const result = await drain(outbox, () => {
      throw new Error("publish failed");
    });
    if (isOk(result)) {
      expect(result.data.published).toBe(0);
      expect(result.data.failed).toBe(1);
    }
    const got = await outbox.get("evt-1");
    if (isOk(got)) {
      expect(got.data?.status).toBe("failed");
      expect(got.data?.attempts).toBe(1);
    }
  });
});

describe("Supabase-backed outbox (fake client)", () => {
  it("appends, lists, and marks published", async () => {
    const fake = createFakeSupabase({ outbox_events: [] });
    const outbox = createSupabaseOutbox(fake.client as never);

    const appended = await outbox.append(append("0xa"));
    expect(isOk(appended)).toBe(true);
    const id = isOk(appended) ? appended.data.id : "";

    const pending = await outbox.pending();
    if (isOk(pending)) expect(pending.data).toHaveLength(1);

    const marked = await outbox.markPublished(id);
    if (isOk(marked)) expect(marked.data.status).toBe("published");

    const afterPending = await outbox.pending();
    if (isOk(afterPending)) expect(afterPending.data).toHaveLength(0);

    const failed = await outbox.markFailed(id, { code: "X", message: "e" });
    if (isOk(failed)) expect(failed.data.attempts).toBe(1);
  });
});
