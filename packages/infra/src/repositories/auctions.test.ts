import { describe, it, expect } from "vitest";
import { createAuctionsRepository } from "./auctions.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ auctions: [] });
  return { fake, repo: createAuctionsRepository(fake.client as never) };
}

describe("AuctionsRepository", () => {
  it("upserts and reads back an auction", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "auc-1",
      seller: ADDR("1"),
      tokenId: "42",
      highestBid: "900",
      status: "active",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.highestBid).toBe("900");

    const found = await repo.findById("auc-1");
    if (isOk(found)) expect(found.data?.tokenId).toBe("42");
  });

  it("filters by status and seller", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "auc-1", seller: ADDR("1"), status: "active" });
    await repo.upsert({ id: "auc-2", seller: ADDR("1"), status: "settled" });
    await repo.upsert({ id: "auc-3", seller: ADDR("9"), status: "active" });

    const active = await repo.findByStatus("active");
    if (isOk(active)) expect(active.data.map((a) => a.id).sort()).toEqual(["auc-1", "auc-3"]);

    const bySeller = await repo.findBySeller(ADDR("1"));
    if (isOk(bySeller)) expect(bySeller.data).toHaveLength(2);
  });

  it("rejects a non-numeric highest bid", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "auc-x", highestBid: "lots" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("auctions")).toHaveLength(0);
  });
});
