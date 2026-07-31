import { describe, it, expect } from "vitest";
import { createClaimsRepository } from "./claims.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ claims: [] });
  return { fake, repo: createClaimsRepository(fake.client as never) };
}

describe("ClaimsRepository", () => {
  it("upserts and reads back a claim", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "clm-1",
      policyId: "pol-1",
      claimant: ADDR("1"),
      amount: "250000",
      status: "filed",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.amount).toBe("250000");

    const found = await repo.findById("clm-1");
    if (isOk(found)) expect(found.data?.policyId).toBe("pol-1");
  });

  it("filters by policy and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "clm-1", policyId: "pol-1", status: "filed" });
    await repo.upsert({ id: "clm-2", policyId: "pol-1", status: "paid" });
    await repo.upsert({ id: "clm-3", policyId: "pol-2", status: "filed" });

    const byPolicy = await repo.findByPolicy("pol-1");
    if (isOk(byPolicy)) expect(byPolicy.data).toHaveLength(2);

    const filed = await repo.findByStatus("filed");
    if (isOk(filed)) expect(filed.data.map((c) => c.id).sort()).toEqual(["clm-1", "clm-3"]);
  });

  it("rejects an invalid status before hitting the DB", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "clm-x", status: "bogus" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("claims")).toHaveLength(0);
  });
});
