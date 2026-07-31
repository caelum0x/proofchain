import { describe, it, expect } from "vitest";
import { createDealsRepository } from "./deals.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ deals: [] });
  return { fake, repo: createDealsRepository(fake.client as never) };
}

describe("DealsRepository", () => {
  it("upserts and reads back a deal", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      batchId: B32("a"),
      buyer: ADDR("1"),
      supplier: ADDR("2"),
      token: ADDR("3"),
      amount: "1000000",
      state: "funded",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.amount).toBe("1000000");

    const found = await repo.findById(B32("a"));
    if (isOk(found)) expect(found.data?.state).toBe("funded");
  });

  it("filters by buyer and by state", async () => {
    const { repo } = seededRepo();
    await repo.upsert({
      batchId: B32("a"), buyer: ADDR("1"), supplier: ADDR("2"), token: ADDR("3"),
      amount: "1", state: "funded",
    });
    await repo.upsert({
      batchId: B32("b"), buyer: ADDR("1"), supplier: ADDR("2"), token: ADDR("3"),
      amount: "2", state: "released",
    });
    await repo.upsert({
      batchId: B32("c"), buyer: ADDR("9"), supplier: ADDR("2"), token: ADDR("3"),
      amount: "3", state: "funded",
    });

    const byBuyer = await repo.findByBuyer(ADDR("1"));
    if (isOk(byBuyer)) expect(byBuyer.data).toHaveLength(2);

    const funded = await repo.findByState("funded");
    if (isOk(funded)) expect(funded.data.map((d) => d.batchId).sort()).toEqual([B32("a"), B32("c")]);
  });

  it("rejects an invalid amount before hitting the DB", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({
      batchId: B32("a"), buyer: ADDR("1"), supplier: ADDR("2"), token: ADDR("3"),
      amount: "10.5", state: "funded",
    } as never);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
    expect(fake.tables.get("deals")).toHaveLength(0);
  });
});
