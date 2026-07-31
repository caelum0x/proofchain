import { describe, it, expect } from "vitest";
import { createListingsRepository } from "./listings.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ listings: [] });
  return { fake, repo: createListingsRepository(fake.client as never) };
}

describe("ListingsRepository", () => {
  it("upserts and reads back a listing", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "lst-1",
      kind: "fixed_price",
      seller: ADDR("1"),
      price: "1000",
      status: "active",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.price).toBe("1000");

    const found = await repo.findById("lst-1");
    if (isOk(found)) expect(found.data?.kind).toBe("fixed_price");
  });

  it("filters by seller, status and kind", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "lst-1", kind: "fixed_price", seller: ADDR("1"), status: "active" });
    await repo.upsert({ id: "lst-2", kind: "offer", seller: ADDR("1"), status: "filled" });
    await repo.upsert({ id: "lst-3", kind: "fixed_price", seller: ADDR("9"), status: "active" });

    const bySeller = await repo.findBySeller(ADDR("1"));
    if (isOk(bySeller)) expect(bySeller.data).toHaveLength(2);

    const active = await repo.findByStatus("active");
    if (isOk(active)) expect(active.data).toHaveLength(2);

    const fixed = await repo.findByKind("fixed_price");
    if (isOk(fixed)) expect(fixed.data.map((l) => l.id).sort()).toEqual(["lst-1", "lst-3"]);
  });

  it("rejects a negative-format price string", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "lst-x", price: "-5" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("listings")).toHaveLength(0);
  });
});
