import { describe, it, expect } from "vitest";
import { createFinancingListingsRepository } from "./financing_listings.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ financing_listings: [] });
  return { fake, repo: createFinancingListingsRepository(fake.client as never) };
}

describe("FinancingListingsRepository", () => {
  it("defaults ask amount and status", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ batchId: B32("a"), supplier: ADDR("1") });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.askAmount).toBe("0");
      expect(res.data.status).toBe("listed");
      expect(res.data.advanceAmount).toBeNull();
    }
  });

  it("filters by supplier, lender and status", async () => {
    const { repo: r } = repo();
    await r.upsert({ batchId: B32("a"), supplier: ADDR("1"), status: "listed" });
    await r.upsert({ batchId: B32("b"), supplier: ADDR("1"), lender: ADDR("5"), status: "funded" });
    await r.upsert({ batchId: B32("c"), supplier: ADDR("2"), status: "listed" });

    const bySupplier = await r.findBySupplier(ADDR("1"));
    if (isOk(bySupplier)) expect(bySupplier.data).toHaveLength(2);
    const byLender = await r.findByLender(ADDR("5"));
    if (isOk(byLender)) expect(byLender.data).toHaveLength(1);
    const listed = await r.findByStatus("listed");
    if (isOk(listed)) expect(listed.data).toHaveLength(2);
  });

  it("rejects an invalid status", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ batchId: B32("a"), supplier: ADDR("1"), status: "open" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("financing_listings")).toHaveLength(0);
  });
});
