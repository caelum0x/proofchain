import { describe, it, expect } from "vitest";
import { createReputationRepository } from "./reputation.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ reputation: [] });
  return { fake, repo: createReputationRepository(fake.client as never) };
}

describe("ReputationRepository", () => {
  it("defaults counters to zero and reads back numeric fields", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ supplier: ADDR("1"), avgScoreBps: 8500, grade: 2 });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.avgScoreBps).toBe(8500);
      expect(res.data.totalDeals).toBe(0);
      expect(res.data.grade).toBe(2);
    }
  });

  it("ranks by score and filters by grade / threshold", async () => {
    const { repo: r } = repo();
    await r.upsert({ supplier: ADDR("1"), avgScoreBps: 9000, grade: 1 });
    await r.upsert({ supplier: ADDR("2"), avgScoreBps: 7000, grade: 2 });
    await r.upsert({ supplier: ADDR("3"), avgScoreBps: 8000, grade: 1 });

    const top = await r.topByScore(2);
    if (isOk(top)) expect(top.data.map((x) => x.avgScoreBps)).toEqual([9000, 8000]);

    const grade1 = await r.findByGrade(1);
    if (isOk(grade1)) expect(grade1.data).toHaveLength(2);

    const above = await r.findAboveScore(8000);
    if (isOk(above)) expect(above.data.map((x) => x.supplier)).toEqual([ADDR("1"), ADDR("3")]);
  });

  it("rejects an out-of-range basis-point score", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ supplier: ADDR("1"), avgScoreBps: 20000 } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("reputation")).toHaveLength(0);
  });
});
