import { describe, it, expect } from "vitest";
import { createInspectionsRepository } from "./inspections.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ inspections: [] });
  return { fake, repo: createInspectionsRepository(fake.client as never) };
}

describe("InspectionsRepository", () => {
  it("upserts and reads back an inspection", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "ins-1",
      batchId: B32("a"),
      inspector: ADDR("1"),
      result: "passed",
      score: 9500,
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.score).toBe(9500);

    const found = await repo.findById("ins-1");
    if (isOk(found)) expect(found.data?.result).toBe("passed");
  });

  it("filters by batch, inspector and result", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "ins-1", batchId: B32("a"), inspector: ADDR("1"), result: "passed" });
    await repo.upsert({ id: "ins-2", batchId: B32("a"), inspector: ADDR("2"), result: "failed" });
    await repo.upsert({ id: "ins-3", batchId: B32("b"), inspector: ADDR("1"), result: "failed" });

    const byBatch = await repo.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data).toHaveLength(2);

    const byInspector = await repo.findByInspector(ADDR("1"));
    if (isOk(byInspector)) expect(byInspector.data).toHaveLength(2);

    const failed = await repo.findByResult("failed");
    if (isOk(failed)) expect(failed.data.map((i) => i.id).sort()).toEqual(["ins-2", "ins-3"]);
  });

  it("rejects an invalid result value", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "ins-x", result: "maybe" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("inspections")).toHaveLength(0);
  });
});
