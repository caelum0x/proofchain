import { describe, it, expect } from "vitest";
import { createInvoicesRepository } from "./invoices.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ invoices: [] });
  return { fake, repo: createInvoicesRepository(fake.client as never) };
}

describe("InvoicesRepository", () => {
  it("upserts with defaulted amount/status and keeps amount as a string", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ id: "inv-1", seller: ADDR("1"), buyer: ADDR("2"), amount: "250000" });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.amount).toBe("250000");
      expect(res.data.status).toBe("issued");
    }
  });

  it("filters by seller, buyer, status and batch", async () => {
    const { repo: r } = repo();
    await r.upsert({ id: "a", seller: ADDR("1"), buyer: ADDR("2"), status: "paid", batchId: B32("a") });
    await r.upsert({ id: "b", seller: ADDR("1"), buyer: ADDR("3"), status: "issued", batchId: B32("a") });
    await r.upsert({ id: "c", seller: ADDR("9"), buyer: ADDR("2"), status: "paid" });

    const bySeller = await r.findBySeller(ADDR("1"));
    if (isOk(bySeller)) expect(bySeller.data).toHaveLength(2);
    const byBuyer = await r.findByBuyer(ADDR("2"));
    if (isOk(byBuyer)) expect(byBuyer.data).toHaveLength(2);
    const paid = await r.findByStatus("paid");
    if (isOk(paid)) expect(paid.data).toHaveLength(2);
    const byBatch = await r.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("rejects an invalid status", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ id: "x", seller: ADDR("1"), status: "void" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("invoices")).toHaveLength(0);
  });
});
