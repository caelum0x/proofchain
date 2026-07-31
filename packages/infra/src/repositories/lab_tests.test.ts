import { describe, it, expect } from "vitest";
import { createLabTestsRepository } from "./lab_tests.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ lab_tests: [] });
  return { fake, repo: createLabTestsRepository(fake.client as never) };
}

describe("LabTestsRepository", () => {
  it("upserts and reads back a lab test", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "lab-1",
      batchId: B32("a"),
      lab: ADDR("1"),
      testType: "pesticide",
      result: "passed",
      reportHash: B32("b"),
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.testType).toBe("pesticide");

    const found = await repo.findById("lab-1");
    if (isOk(found)) expect(found.data?.result).toBe("passed");
  });

  it("filters by batch, lab and result", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "lab-1", batchId: B32("a"), lab: ADDR("1"), result: "passed" });
    await repo.upsert({ id: "lab-2", batchId: B32("a"), lab: ADDR("2"), result: "failed" });
    await repo.upsert({ id: "lab-3", batchId: B32("b"), lab: ADDR("1"), result: "failed" });

    const byBatch = await repo.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data).toHaveLength(2);

    const byLab = await repo.findByLab(ADDR("1"));
    if (isOk(byLab)) expect(byLab.data).toHaveLength(2);

    const failed = await repo.findByResult("failed");
    if (isOk(failed)) expect(failed.data.map((t) => t.id).sort()).toEqual(["lab-2", "lab-3"]);
  });

  it("rejects a malformed report hash", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "lab-x", reportHash: "0xdead" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("lab_tests")).toHaveLength(0);
  });
});
