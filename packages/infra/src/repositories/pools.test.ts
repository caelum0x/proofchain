import { describe, it, expect } from "vitest";
import { createPoolsRepository } from "./pools.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ pools: [] });
  return { fake, repo: createPoolsRepository(fake.client as never) };
}

describe("PoolsRepository", () => {
  it("defaults share accounting to zero strings", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ id: "pool-1", manager: ADDR("1"), riskGrade: 3 });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.totalAssets).toBe("0");
      expect(res.data.totalShares).toBe("0");
      expect(res.data.riskGrade).toBe(3);
    }
  });

  it("filters by manager and risk grade", async () => {
    const { repo: r } = repo();
    await r.upsert({ id: "a", manager: ADDR("1"), riskGrade: 1 });
    await r.upsert({ id: "b", manager: ADDR("1"), riskGrade: 2 });
    await r.upsert({ id: "c", manager: ADDR("2"), riskGrade: 1 });

    const byManager = await r.findByManager(ADDR("1"));
    if (isOk(byManager)) expect(byManager.data).toHaveLength(2);
    const grade1 = await r.findByRiskGrade(1);
    if (isOk(grade1)) expect(grade1.data.map((p) => p.id).sort()).toEqual(["a", "c"]);
  });

  it("rejects a non-numeric total asset value", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ id: "x", totalAssets: "abc" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("pools")).toHaveLength(0);
  });
});
