import { describe, it, expect } from "vitest";
import { createPoliciesRepository } from "./policies.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ policies: [] });
  return { fake, repo: createPoliciesRepository(fake.client as never) };
}

describe("PoliciesRepository", () => {
  it("upserts and reads back a policy", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "pol-1",
      holder: ADDR("1"),
      batchId: B32("a"),
      coverage: "1000000",
      premium: "5000",
      status: "active",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.coverage).toBe("1000000");

    const found = await repo.findById("pol-1");
    if (isOk(found)) expect(found.data?.status).toBe("active");
  });

  it("filters by holder and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "pol-1", holder: ADDR("1"), status: "active" });
    await repo.upsert({ id: "pol-2", holder: ADDR("1"), status: "claimed" });
    await repo.upsert({ id: "pol-3", holder: ADDR("9"), status: "active" });

    const byHolder = await repo.findByHolder(ADDR("1"));
    if (isOk(byHolder)) expect(byHolder.data).toHaveLength(2);

    const active = await repo.findByStatus("active");
    if (isOk(active)) expect(active.data.map((p) => p.id).sort()).toEqual(["pol-1", "pol-3"]);
  });

  it("rejects a non-numeric coverage before hitting the DB", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "pol-x", coverage: "1.5" } as never);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
    expect(fake.tables.get("policies")).toHaveLength(0);
  });
});
