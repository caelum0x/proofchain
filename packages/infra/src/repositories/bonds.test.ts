import { describe, it, expect } from "vitest";
import { createBondsRepository } from "./bonds.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ bonds: [] });
  return { fake, repo: createBondsRepository(fake.client as never) };
}

describe("BondsRepository", () => {
  it("defaults amounts and status, keeps amount as string", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ supplier: ADDR("1"), amount: "5000", token: ADDR("a") });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.amount).toBe("5000");
      expect(res.data.locked).toBe("0");
      expect(res.data.status).toBe("active");
    }
  });

  it("filters by status and token", async () => {
    const { repo: r } = repo();
    await r.upsert({ supplier: ADDR("1"), status: "active", token: ADDR("a") });
    await r.upsert({ supplier: ADDR("2"), status: "slashed", token: ADDR("a") });
    await r.upsert({ supplier: ADDR("3"), status: "active", token: ADDR("b") });

    const active = await r.findByStatus("active");
    if (isOk(active)) expect(active.data).toHaveLength(2);
    const tokenA = await r.findByToken(ADDR("a"));
    if (isOk(tokenA)) expect(tokenA.data).toHaveLength(2);
  });

  it("rejects an invalid status and a non-numeric amount", async () => {
    const { fake, repo: r } = repo();
    const bad1 = await r.upsert({ supplier: ADDR("1"), status: "frozen" } as never);
    expect(isErr(bad1)).toBe(true);
    const bad2 = await r.upsert({ supplier: ADDR("1"), amount: "1.5" } as never);
    expect(isErr(bad2)).toBe(true);
    expect(fake.tables.get("bonds")).toHaveLength(0);
  });
});
