import { describe, it, expect } from "vitest";
import { createPassportsRepository } from "./passports.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ passports: [] });
  return { fake, repo: createPassportsRepository(fake.client as never) };
}

describe("PassportsRepository", () => {
  it("upserts and reads back a passport by tokenId", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      tokenId: "7",
      owner: ADDR("1"),
      batchId: B32("a"),
      productName: "Organic Coffee",
      status: "issued",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.productName).toBe("Organic Coffee");

    const found = await repo.findById("7");
    if (isOk(found)) expect(found.data?.status).toBe("issued");
  });

  it("filters by owner and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ tokenId: "1", owner: ADDR("1"), status: "active" });
    await repo.upsert({ tokenId: "2", owner: ADDR("1"), status: "retired" });
    await repo.upsert({ tokenId: "3", owner: ADDR("9"), status: "active" });

    const byOwner = await repo.findByOwner(ADDR("1"));
    if (isOk(byOwner)) expect(byOwner.data).toHaveLength(2);

    const active = await repo.findByStatus("active");
    if (isOk(active)) expect(active.data.map((p) => p.tokenId).sort()).toEqual(["1", "3"]);
  });

  it("rejects a non-numeric tokenId", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ tokenId: "abc" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("passports")).toHaveLength(0);
  });
});
