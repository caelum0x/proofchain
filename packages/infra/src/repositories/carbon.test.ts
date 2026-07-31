import { describe, it, expect } from "vitest";
import { createCarbonRepository } from "./carbon.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;

function seededRepo() {
  const fake = createFakeSupabase({ carbon: [] });
  return { fake, repo: createCarbonRepository(fake.client as never) };
}

describe("CarbonRepository", () => {
  it("upserts and reads back a carbon record", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "car-1",
      projectId: "proj-1",
      batchId: B32("a"),
      co2e: "1000",
      retired: "250",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.co2e).toBe("1000");

    const found = await repo.findById("car-1");
    if (isOk(found)) expect(found.data?.retired).toBe("250");
  });

  it("filters by project and batch", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "car-1", projectId: "proj-1", batchId: B32("a") });
    await repo.upsert({ id: "car-2", projectId: "proj-1", batchId: B32("b") });
    await repo.upsert({ id: "car-3", projectId: "proj-2", batchId: B32("a") });

    const byProject = await repo.findByProject("proj-1");
    if (isOk(byProject)) expect(byProject.data).toHaveLength(2);

    const byBatch = await repo.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data.map((c) => c.id).sort()).toEqual(["car-1", "car-3"]);
  });

  it("rejects a non-numeric co2e", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "car-x", co2e: "lots" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("carbon")).toHaveLength(0);
  });
});
