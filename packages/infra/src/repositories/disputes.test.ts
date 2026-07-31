import { describe, it, expect } from "vitest";
import { createDisputesRepository } from "./disputes.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ disputes: [] });
  return { fake, repo: createDisputesRepository(fake.client as never) };
}

describe("DisputesRepository", () => {
  it("upserts and reads back a dispute keyed by batch", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      batchId: B32("a"),
      opener: ADDR("1"),
      status: "open",
      votesFor: 2,
      votesAgainst: 1,
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.votesFor).toBe(2);

    const found = await repo.findById(B32("a"));
    if (isOk(found)) expect(found.data?.status).toBe("open");
  });

  it("filters by status and opener", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ batchId: B32("a"), opener: ADDR("1"), status: "open" });
    await repo.upsert({ batchId: B32("b"), opener: ADDR("1"), status: "resolved" });
    await repo.upsert({ batchId: B32("c"), opener: ADDR("9"), status: "open" });

    const open = await repo.findByStatus("open");
    if (isOk(open)) expect(open.data.map((d) => d.batchId).sort()).toEqual([B32("a"), B32("c")]);

    const byOpener = await repo.findByOpener(ADDR("1"));
    if (isOk(byOpener)) expect(byOpener.data).toHaveLength(2);
  });

  it("rejects a malformed batch id", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ batchId: "0xdead" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("disputes")).toHaveLength(0);
  });
});
