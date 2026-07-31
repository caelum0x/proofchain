import { describe, it, expect } from "vitest";
import { createEsgRepository } from "./esg.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

function seededRepo() {
  const fake = createFakeSupabase({ esg: [] });
  return { fake, repo: createEsgRepository(fake.client as never) };
}

describe("EsgRepository", () => {
  it("upserts and reads back an ESG score", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({ id: "esg-1", subject: "supplier-a", score: 8200 });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.score).toBe(8200);

    const found = await repo.findById("esg-1");
    if (isOk(found)) expect(found.data?.subject).toBe("supplier-a");
  });

  it("filters by subject and threshold", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "esg-1", subject: "supplier-a", score: 8200 });
    await repo.upsert({ id: "esg-2", subject: "supplier-a", score: 4000 });
    await repo.upsert({ id: "esg-3", subject: "supplier-b", score: 9000 });

    const bySubject = await repo.findBySubject("supplier-a");
    if (isOk(bySubject)) expect(bySubject.data).toHaveLength(2);

    const strong = await repo.findAtLeast(8000);
    if (isOk(strong)) expect(strong.data.map((e) => e.id).sort()).toEqual(["esg-1", "esg-3"]);
  });

  it("rejects an out-of-range basis-point score", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "esg-x", subject: "s", score: 20000 } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("esg")).toHaveLength(0);
  });
});
