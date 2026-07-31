import { describe, it, expect } from "vitest";
import { createBatchesRepository } from "./batches.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ batches: [] });
  return { fake, repo: createBatchesRepository(fake.client as never) };
}

describe("BatchesRepository", () => {
  it("upserts with defaulted quantity/status and reads back", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ batchId: B32("a"), supplier: ADDR("1"), product: "Coffee" });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.quantity).toBe("0");
      expect(res.data.status).toBe("created");
      expect(res.data.product).toBe("Coffee");
    }
    const found = await r.findById(B32("a"));
    if (isOk(found)) expect(found.data?.supplier).toBe(ADDR("1"));
  });

  it("filters by supplier, buyer and status", async () => {
    const { repo: r } = repo();
    await r.upsert({ batchId: B32("a"), supplier: ADDR("1"), buyer: ADDR("5"), status: "delivered" });
    await r.upsert({ batchId: B32("b"), supplier: ADDR("1"), status: "created" });
    await r.upsert({ batchId: B32("c"), supplier: ADDR("2"), buyer: ADDR("5"), status: "delivered" });

    const bySupplier = await r.findBySupplier(ADDR("1"));
    if (isOk(bySupplier)) expect(bySupplier.data).toHaveLength(2);
    const byBuyer = await r.findByBuyer(ADDR("5"));
    if (isOk(byBuyer)) expect(byBuyer.data).toHaveLength(2);
    const delivered = await r.findByStatus("delivered");
    if (isOk(delivered)) expect(delivered.data.map((b) => b.batchId).sort()).toEqual([B32("a"), B32("c")]);
  });

  it("rejects an invalid status and a malformed content hash", async () => {
    const { fake, repo: r } = repo();
    const bad1 = await r.upsert({ batchId: B32("a"), supplier: ADDR("1"), status: "shipped" } as never);
    expect(isErr(bad1)).toBe(true);
    const bad2 = await r.upsert({ batchId: B32("a"), supplier: ADDR("1"), contentHash: "0xbad" } as never);
    expect(isErr(bad2)).toBe(true);
    expect(fake.tables.get("batches")).toHaveLength(0);
  });
});
